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
        // Небольшая пауза для корректного переключения состояния UI
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
                // Динамический критерий полноты ответа для текущего батча
                const checkComplete = (buf) => {
                    if (buf.length >= 3 && buf[1] === 0x03) {
                        const byteCount = buf[2];
                        return buf.length >= (3 + byteCount + 2); // Адрес + Код + Длина + Данные + CRC
                    }
                    if (buf.length >= 5 && (buf[1] & 0x80)) {
                        return true; // Ответ со стандартной ошибкой Modbus RTU (5 байт)
                    }
                    return false;
                };

                // Отправляем транзакцию в общую безопасную очередь портов
                const reply = await serialManager.executeTransaction(finalPacket, checkComplete, 300);

                if (reply && reply.length >= 3 && reply[1] === 0x03) {
                    const byteCount = reply[2];
                    const expectedTotal = 3 + byteCount + 2;
                    
                    if (reply.length >= expectedTotal) {
                        for (let i = 0; i < count; i++) {
                            const regAddr = batch.start + i;
                            if (registerMap.has(regAddr)) {
                                const tr = registerMap.get(regAddr);
                                const valH = reply[3 + i * 2];
                                const valL = reply[4 + i * 2];
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