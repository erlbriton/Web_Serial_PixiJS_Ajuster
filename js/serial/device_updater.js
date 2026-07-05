import { updateRowValues } from '../ini-manager/tree-ui.js';
import { hexToFloat32, float32ToHex } from '../ini-manager/tree-core.js';
import { calculateCRC, readWithTimeout } from '../serial-actions.js';

let isUpdating = false;

// Очистка стала "агрессивной": ждем данные не дольше 20 мс
async function flushSerialBuffer(serial) {
    // Пытаемся прочитать один раз. Если буфер полон мусора — заберем его, если пуст — идем дальше сразу.
    await readWithTimeout(serial, 20); 
}

export async function updateDeviceRegisters(serial, slaveAddress = 0x01, appState = null) {
    if (isUpdating) return false;
    
    isUpdating = true;
    document.body.classList.add('loading-state');
    
    const wasPolling = appState ? appState.isPolling : false;
    
    if (wasPolling) {
        appState.isPolling = false; 
        // Минимальная пауза, чтобы цикл readLoop увидел флаг isPolling = false и завершился.
        // 20 мс — этого достаточно для реакции JS Event Loop.
        await new Promise(r => setTimeout(r, 20)); 
        await flushSerialBuffer(serial); 
    }

    try {
        const rows = Array.from(document.querySelectorAll('#grid-data-rows tr'));
        const registerMap = new Map();
        const addresses = [];

        for (const tr of rows) {
            const addrStr = tr.getAttribute('data-reg');
            if (!addrStr) continue;
            const addr = parseInt(addrStr, 16);
            registerMap.set(addr, tr);
            addresses.push(addr);
        }
        addresses.sort((a, b) => a - b);
        
        const batches = [];
        if (addresses.length > 0) {
            let currentBatch = { start: addresses[0], end: addresses[0], regs: [addresses[0]] };
            for (let i = 1; i < addresses.length; i++) {
                const nextAddr = addresses[i];
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
                await serial.write(finalPacket);
                let buffer = new Uint8Array(0);
                const startTime = Date.now();
                
                // Читаем ответ. Если данные приходят быстро, мы не ждем весь таймаут.
                while (buffer.length < 5 && (Date.now() - startTime < 100)) {
                    const chunk = await readWithTimeout(serial, 20); 
                    if (chunk && chunk.length > 0) {
                        let newBuffer = new Uint8Array(buffer.length + chunk.length);
                        newBuffer.set(buffer);
                        newBuffer.set(chunk, buffer.length);
                        buffer = newBuffer;
                    }
                }

                if (buffer.length >= 3 && buffer[1] === 0x03) {
                    const byteCount = buffer[2];
                    const expectedTotal = 3 + byteCount + 2;
                    while (buffer.length < expectedTotal && (Date.now() - startTime < 100)) {
                        const chunk = await readWithTimeout(serial, 20);
                        if (chunk && chunk.length > 0) {
                            let newBuffer = new Uint8Array(buffer.length + chunk.length);
                            newBuffer.set(buffer);
                            newBuffer.set(chunk, buffer.length);
                            buffer = newBuffer;
                        }
                    }
                    if (buffer.length >= expectedTotal) {
                        for (let i = 0; i < count; i++) {
                            const regAddr = batch.start + i;
                            if (registerMap.has(regAddr)) {
                                const tr = registerMap.get(regAddr);
                                const valH = buffer[3 + i * 2];
                                const valL = buffer[4 + i * 2];
                                const hexValue = 'x' + ((valH << 8) | valL).toString(16).padStart(4, '0');
                                try {
                                    let parts = JSON.parse(tr.dataset.parts || '[]');
                                    const hIdx = parseInt(tr.getAttribute('data-hex-index') || '0');
                                    parts[hIdx] = hexValue;
                                    tr.dataset.parts = JSON.stringify(parts);
                                    updateRowValues(tr, parts, tr.getAttribute('type'), parseFloat(tr.dataset.scale || 1), hIdx, 4, {}, hexToFloat32, float32ToHex, 6);
                                    tr.classList.add('updated');
                                } catch (e) { console.error(`UI Error:`, e); }
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