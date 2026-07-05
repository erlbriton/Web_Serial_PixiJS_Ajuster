import { updateRowValues } from '../ini-manager/tree-ui.js';
import { hexToFloat32, float32ToHex } from '../ini-manager/tree-core.js';
import { calculateCRC } from '../serial-actions.js';

let isUpdating = false;

export async function updateDeviceRegisters(serial, slaveAddress = 0x01) {
    if (isUpdating) return;
    isUpdating = true;
    document.body.classList.add('loading-state');

    // Кэшируем DOM-элементы один раз
    const rows = Array.from(document.querySelectorAll('#grid-data-rows tr'));
    
    for (const tr of rows) {
        const regAddrString = tr.getAttribute('data-reg');
        if (!regAddrString) continue;

        const regAddr = parseInt(regAddrString, 16);
        
        const body = new Uint8Array([slaveAddress, 0x03, (regAddr >> 8) & 0xFF, regAddr & 0xFF, 0x00, 0x01]);
        const crc = calculateCRC(body);
        const finalPacket = new Uint8Array(8);
        finalPacket.set(body, 0);
        finalPacket[6] = crc & 0xFF;
        finalPacket[7] = (crc >> 8) & 0xFF;

        try {
            await serial.write(finalPacket);
            
            // Минимальная пауза 5-10 мс (Hardware Buffer Threshold)
            await new Promise(res => setTimeout(res, 5)); 
            
            const reply = await serial.readChunk(); 
            
            if (reply && reply.length >= 7) {
                // Ищем начало пакета без лишних циклов
                const startIdx = reply.indexOf(slaveAddress); 
                if (startIdx !== -1 && reply[startIdx+1] === 0x03) {
                    const packet = reply.subarray(startIdx, startIdx + 7);
                    
                    if (calculateCRC(packet.subarray(0, 5)) === ((packet[6] << 8) | packet[5])) {
                        const valH = packet[3];
                        const valL = packet[4];
                        const hexValue = 'x' + ((valH << 8) | valL).toString(16).padStart(4, '0');
                        
                        // Работаем с данными
                        const parts = JSON.parse(tr.dataset.parts || '[]');
                        const dataType = tr.getAttribute('data-type');
                        const scale = parseFloat(tr.dataset.scale || 1);
                        const hIdx = parseInt(tr.getAttribute('data-hex-index') || '0');
                        
                        parts[hIdx] = hexValue; 
                        tr.dataset.parts = JSON.stringify(parts);

                        // Обновление DOM
                        updateRowValues(tr, parts, dataType, scale, hIdx, 4, {}, hexToFloat32, float32ToHex, 6);
                        
                        // Анимация через CSS (без setTimeout!)
                        tr.classList.add('updated');
                        // Браузер сам сбросит класс, если анимация закончится, 
                        // либо можно добавить обработчик, но для скорости достаточно и этого.
                        // Если нужно 100% очищать класс:
                        setTimeout(() => tr.classList.remove('updated'), 400); 
                    }
                }
            }
        } catch (err) {
            console.error(`Ошибка при чтении ${regAddrString}:`, err);
        }
    }

    isUpdating = false;
    document.body.classList.remove('loading-state');
}