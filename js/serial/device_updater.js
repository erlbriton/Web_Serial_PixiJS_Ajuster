import { updateRowValues } from '../ini-manager/tree-ui.js';
import { hexToFloat32, float32ToHex } from '../ini-manager/tree-core.js';

export async function updateDeviceRegisters(serial, slaveAddress = 0x01) {
    const rows = document.querySelectorAll('#grid-data-rows tr');
    
    for (const tr of rows) {
        const regAddrString = tr.getAttribute('data-reg');
        if (!regAddrString) continue;

        const regAddr = parseInt(regAddrString, 16);
        
        // Формируем пакет Modbus (Функция 03, чтение 1 регистра)
        const body = new Uint8Array([
            slaveAddress, 0x03, 
            (regAddr >> 8) & 0xFF, regAddr & 0xFF, 
            0x00, 0x01 // Читаем 1 регистр
        ]);
        
        // Расчет CRC-16 Modbus
        let crc = 0xFFFF;
        for (let pos = 0; pos < body.length; pos++) {
            crc ^= body[pos];
            for (let i = 8; i !== 0; i--) {
                if ((crc & 0x0001) !== 0) { 
                    crc >>= 1; crc ^= 0xA001; 
                } else { 
                    crc >>= 1; 
                }
            }
        }
        
        const finalPacket = new Uint8Array(8);
        finalPacket.set(body, 0);
        finalPacket[6] = crc & 0xFF;
        finalPacket[7] = (crc >> 8) & 0xFF;

        try {
            await serial.write(finalPacket);
            const reply = await serial.readChunk(); 
            
            if (reply && reply.length >= 5) {
                // 1. Формируем HEX-строку из ответа
                const valH = reply[3];
                const valL = reply[4];
                const hexValue = 'x' + ((valH << 8) | valL).toString(16).padStart(4, '0');
                
                // 2. Получаем данные строки
                const parts = JSON.parse(tr.dataset.parts || '[]');
                const dataType = tr.getAttribute('data-type');
                const scale = parseFloat(tr.dataset.scale || 1);
                
                // 3. Получаем индекс из атрибута, который мы добавили на прошлом шаге
                const hIdx = parseInt(tr.getAttribute('data-hex-index') || '0');
                
                // 4. Обновляем массив и перерисовываем строку
                parts[hIdx] = hexValue; 

                console.log("ВНИМАНИЕ! НОВЫЙ КОД РАБОТАЕТ И ПЫТАЕТСЯ ПИСАТЬ В КОЛОНКУ 6/7!");

                updateRowValues(tr, parts, dataType, scale, hIdx, 4, {}, hexToFloat32, float32ToHex, 6);
                
                tr.classList.add('updated');
                setTimeout(() => tr.classList.remove('updated'), 300);
            }
        } catch (err) {
            console.error(`Ошибка при чтении ${regAddrString}:`, err);
        }
        
        // Пауза между запросами, чтобы не перегрузить устройство
        await new Promise(res => setTimeout(res, 20));
    }
}