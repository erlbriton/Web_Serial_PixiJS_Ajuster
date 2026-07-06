import { updateRowValues } from '../ini-manager/tree-ui.js';
import { hexToFloat32, float32ToHex } from '../ini-manager/tree-core.js';
import { calculateCRC, serialManager } from '../serial-actions.js';

let isUpdating = false;

async function flushSerialBuffer(serial) {
    // Больше не требуется, так как единый ридер сам контролирует поток данных
}

export async function updateDeviceRegisters(serial, slaveAddress = 0x01, appState = null) {
    if (isUpdating) return false;
    
    isUpdating = true;
    document.body.classList.add('loading-state');
    
    const wasPolling = appState ? appState.isPolling : false;
    
    if (wasPolling) {
        appState.isPolling = false; 
        await new Promise(r => setTimeout(r, 20)); 
    }

    try {
        const rows = Array.from(document.querySelectorAll('#grid-data-rows tr'));
        const registerMap = new Map();
        const addresses = [];

        for (const tr of rows) {
            const addrStr = tr.getAttribute('data-reg');
            if (!addrStr) continue;
            const addr = parseInt(addrStr, 16);
            
            if (!registerMap.has(addr)) {
                registerMap.set(addr, []);
            }
            registerMap.get(addr).push(tr);
            
            const dataType = tr.getAttribute('data-type');
            if (dataType === 'TFloat' || dataType === 'TDWORD') {
                addresses.push(addr);
                addresses.push(addr + 1);
            } else {
                addresses.push(addr);
            }
        }
        
        const uniqueAddresses = [...new Set(addresses)].sort((a, b) => a - b);
        
        const batches = [];
        if (uniqueAddresses.length > 0) {
            let currentBatch = { start: uniqueAddresses[0], end: uniqueAddresses[0], regs: [uniqueAddresses[0]] };
            for (let i = 1; i < uniqueAddresses.length; i++) {
                const nextAddr = uniqueAddresses[i];
                const gap = nextAddr - currentBatch.end - 1;
                if (gap <= 3 && (nextAddr - currentBatch.start + 1) <= 125) {
                    currentBatch.end = nextAddr;
                    currentBatch.regs.push(nextAddr);
                } else {
                    batches.push(currentBatch);
                    currentBatch = { start: nextAddr, end: nextAddr, regs: [nextAddr] };
                }
            }
            batches.push(currentBatch);
        }

        for (const batch of batches) {
            const count = batch.end - batch.start + 1;
            const body = new Uint8Array([slaveAddress, 0x03, (batch.start >> 8) & 0xFF, batch.start & 0xFF, (count >> 8) & 0xFF, count & 0xFF]);
            const crc = calculateCRC(body);
            const finalPacket = new Uint8Array(8);
            finalPacket.set(body, 0);
            finalPacket[6] = crc & 0xFF;
            finalPacket[7] = (crc >> 8) & 0xFF;

            try {
                const checkComplete = (buf) => {
                    if (buf.length >= 3 && buf[1] === 0x03) {
                        const byteCount = buf[2];
                        return buf.length >= (3 + byteCount + 2);
                    }
                    if (buf.length >= 5 && (buf[1] & 0x80)) {
                        return true;
                    }
                    return false;
                };

                const reply = await serialManager.executeTransaction(finalPacket, checkComplete, 300);

                if (reply && reply.length >= 3 && reply[1] === 0x03) {
                    const byteCount = reply[2];
                    const expectedTotal = 3 + byteCount + 2;
                    
                    if (reply.length >= expectedTotal) {
                        for (let i = 0; i < count; i++) {
                            const regAddr = batch.start + i;
                            
                            if (registerMap.has(regAddr)) {
                                const trList = registerMap.get(regAddr);
                                
                                for (const tr of trList) {
                                    try {
                                        let parts = JSON.parse(tr.dataset.parts || '[]');
                                        const dataType = tr.getAttribute('data-type') || '';
                                        const sub = tr.getAttribute('data-sub') || '';
                                        const hIdx = parseInt(tr.getAttribute('data-hex-index') || '0');
                                        
                                        let originalHexLen = 4;
                                        if (parts[hIdx] && parts[hIdx].startsWith('x')) {
                                            originalHexLen = parts[hIdx].slice(1).length;
                                        }

                                        // Разрешение множителя
                                        let scale = NaN;
                                        let scaleStr = '1.0';
                                        if (parts[6]) {
                                            scaleStr = parts[6].trim();
                                            
                                            if (isNaN(Number(scaleStr.replace(',', '.')))) {
                                                const varName = scaleStr.toLowerCase();
                                                let resolvedValue = null;
                                                
                                                if (appState) {
                                                    const varsObj = appState.vars || appState.iniVars || appState.variables || (appState.iniData ? appState.iniData.vars : null);
                                                    if (varsObj && typeof varsObj === 'object') {
                                                        const targetKey = Object.keys(varsObj).find(k => k.toLowerCase() === varName);
                                                        if (targetKey) {
                                                            resolvedValue = varsObj[targetKey];
                                                        }
                                                    }
                                                }
                                                
                                                if (resolvedValue === null && window.iniVars && typeof window.iniVars === 'object') {
                                                    const targetKey = Object.keys(window.iniVars).find(k => k.toLowerCase() === varName);
                                                    if (targetKey) {
                                                        resolvedValue = window.iniVars[targetKey];
                                                    }
                                                }

                                                if (resolvedValue !== null && resolvedValue !== undefined) {
                                                    scaleStr = String(resolvedValue);
                                                }
                                            }
                                            scaleStr = scaleStr.replace(',', '.');
                                            scale = parseFloat(scaleStr);
                                        }
                                        if (isNaN(scale)) {
                                            scale = 1.0;
                                            scaleStr = '1.0';
                                        }

                                        let prmListOptions = {};
                                        for (let j = parts.length - 1; j >= 3; j--) {
                                            const part = parts[j] ? parts[j].trim() : '';
                                            if (part.includes('#')) {
                                                const [h, t] = part.split('#');
                                                if (h && t) {
                                                    prmListOptions[h.toLowerCase()] = t;
                                                }
                                            }
                                        }

                                        const valH = reply[3 + i * 2];
                                        const valL = reply[4 + i * 2];
                                        const word = (valH << 8) | valL;

                                        let hexValue = '';

                                        if (dataType === 'TByte' || dataType === 'TPrmList') {
                                            if (sub === 'H') {
                                                const byteVal = (word >> 8) & 0xFF;
                                                hexValue = 'x' + byteVal.toString(16).padStart(originalHexLen, '0');
                                            } else {
                                                const byteVal = word & 0xFF;
                                                hexValue = 'x' + byteVal.toString(16).padStart(originalHexLen, '0');
                                            }
                                        } else if (dataType === 'TBit') {
                                            const bitIndex = parseInt(sub, 16);
                                            const bitVal = (word >> bitIndex) & 1;
                                            hexValue = 'x' + bitVal.toString(16).padStart(originalHexLen, '0');
                                        } else if (dataType === 'TFloat' || dataType === 'TDWORD') {
                                            if (i + 1 < count) {
                                                const nextValH = reply[3 + (i + 1) * 2];
                                                const nextValL = reply[4 + (i + 1) * 2];
                                                const nextWord = (nextValH << 8) | nextValL;
                                                hexValue = 'x' + nextWord.toString(16).padStart(4, '0') + word.toString(16).padStart(4, '0');
                                            } else {
                                                continue;
                                            }
                                        } else {
                                            hexValue = 'x' + word.toString(16).padStart(originalHexLen, '0');
                                        }

                                        if (hexValue) {
                                            parts[hIdx] = hexValue;
                                            parts[6] = scaleStr;
                                            
                                            tr.dataset.parts = JSON.stringify(parts);
                                            
                                            updateRowValues(tr, parts, dataType, scale, hIdx, originalHexLen, prmListOptions, hexToFloat32, float32ToHex, 6);
                                            tr.classList.add('updated');
                                        }
                                    } catch (e) { 
                                        console.error(`Ошибка обработки строки для регистра 0x${regAddr.toString(16)}:`, e); 
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) { console.error(`Batch error:`, err); }
        }
    } finally {
        isUpdating = false;
        document.body.classList.remove('loading-state');
    }
    return wasPolling;
}

export function resetUpdateState() {
    isUpdating = false;
    document.body.classList.remove('loading-state');
    console.log("Состояние обновления принудительно сброшено.");
}

window.resetUpdateState = resetUpdateState;

document.addEventListener('force-reset-updater', () => {
    isUpdating = false;
    document.body.classList.remove('loading-state');
    console.log("Updater: Получен сигнал сброса, isUpdating = false");
});