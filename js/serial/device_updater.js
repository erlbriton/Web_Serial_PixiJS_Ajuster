import { updateRowValues } from '../ini-manager/tree-ui.js';
import { hexToFloat32, float32ToHex } from '../ini-manager/tree-core.js';
import { calculateCRC } from '../serial-actions.js';

let isUpdating = false;

export async function updateDeviceRegisters(serial, slaveAddress = 0x01) {
    if (isUpdating) return;
    
    isUpdating = true;
    document.body.classList.add('loading-state');

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
        
        console.log(`[DEBUG] Карта регистров загружена: ${registerMap.size} записей.`);

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
            console.log(`[DEBUG] Запрос батча: старт 0x${batch.start.toString(16)}, кол-во: ${count}`);
            
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
                
                // Ждем ответ (минимум 5 байт для ответа)
                while (buffer.length < 5 && (Date.now() - startTime < 300)) {
                    const chunk = await serial.readChunk();
                    if (chunk && chunk.length > 0) {
                        let newBuffer = new Uint8Array(buffer.length + chunk.length);
                        newBuffer.set(buffer);
                        newBuffer.set(chunk, buffer.length);
                        buffer = newBuffer;
                    }
                    await new Promise(r => setTimeout(r, 5));
                }

                if (buffer.length < 3) {
                    console.warn(`[DEBUG] Батч 0x${batch.start.toString(16)}: ответ слишком короткий (${buffer.length} байт)`);
                    continue;
                }

                // Проверка ответа: SlaveID + FuncCode
                if (buffer[0] !== slaveAddress) {
                    console.warn(`[DEBUG] Ошибка адреса: ожидалось 0x${slaveAddress.toString(16)}, получено 0x${buffer[0].toString(16)}`);
                    continue;
                }

                if (buffer[1] === 0x83) {
                    console.error(`[DEBUG] Modbus Error 0x${buffer[2].toString(16)} для батча 0x${batch.start.toString(16)}`);
                    continue;
                }

                if (buffer[1] === 0x03) {
                    const byteCount = buffer[2];
                    const expectedTotal = 3 + byteCount + 2; // ID + Func + Len + Data + CRC
                    
                    // Дочитываем остаток, если пришло не всё
                    while (buffer.length < expectedTotal && (Date.now() - startTime < 300)) {
                        const chunk = await serial.readChunk();
                        if (chunk && chunk.length > 0) {
                            let newBuffer = new Uint8Array(buffer.length + chunk.length);
                            newBuffer.set(buffer);
                            newBuffer.set(chunk, buffer.length);
                            buffer = newBuffer;
                        }
                        await new Promise(r => setTimeout(r, 5));
                    }

                    if (buffer.length >= expectedTotal) {
                        console.log(`[DEBUG] Получен полный пакет для 0x${batch.start.toString(16)}:`, Array.from(buffer));
                        
                        for (let i = 0; i < count; i++) {
                            const regAddr = batch.start + i;
                            if (registerMap.has(regAddr)) {
                                const tr = registerMap.get(regAddr);
                                const valH = buffer[3 + i * 2];
                                const valL = buffer[4 + i * 2];
                                const hexValue = 'x' + ((valH << 8) | valL).toString(16).padStart(4, '0');
                                
                                console.log(`[UI UPDATE] Записываем в 0x${regAddr.toString(16)} значение ${hexValue}`);
                                
                                try {
                                    let parts = JSON.parse(tr.dataset.parts || '[]');
                                    const hIdx = parseInt(tr.getAttribute('data-hex-index') || '0');
                                    parts[hIdx] = hexValue;
                                    tr.dataset.parts = JSON.stringify(parts);
                                    
                                    updateRowValues(tr, parts, tr.getAttribute('data-type'), parseFloat(tr.dataset.scale || 1), hIdx, 4, {}, hexToFloat32, float32ToHex, 6);
                                    tr.classList.add('updated');
                                } catch (e) {
                                    console.error(`[ERROR] Ошибка UI для 0x${regAddr.toString(16)}:`, e);
                                }
                            }
                        }
                    } else {
                        console.warn(`[DEBUG] Пакет не полон: нужно ${expectedTotal}, есть ${buffer.length}`);
                    }
                }
            } catch (err) {
                console.error(`[ERROR] Критическая ошибка батча 0x${batch.start.toString(16)}:`, err);
            }
        }
    } finally {
        isUpdating = false;
        document.body.classList.remove('loading-state');
    }
}