// modbus.js
class ModbusRTU {
    /**
     * Классический таблично-логический расчет контрольной суммы CRC16 (полином 0xA001).
     * @param {Uint8Array} buffer - Массив байт для расчета
     */
    static crc16(buffer) {
        let crc = 0xFFFF;
        for (let i = 0; i < buffer.length; i++) {
            crc ^= buffer[i];
            for (let j = 8; j !== 0; j--) {
                if ((crc & 0x0001) !== 0) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        return crc;
    }

    /**
     * Сборка бинарного запроса функции 03 (Чтение удерживающих регистров).
     * @param {number} slaveId - Адрес устройства на шине Modbus (обычно 1)
     * @param {number} regAddr - Номер регистра (например, 45 для 0x002D)
     */
    static createReadRequest(slaveId, regAddr) {
        const request = new Uint8Array(8);
        request[0] = slaveId;
        request[1] = 0x03; // Функция чтения
        request[2] = (regAddr >> 8) & 0xFF; // Адрес регистра HI
        request[3] = regAddr & 0xFF;        // Адрес регистра LO
        request[4] = 0x00; 
        request[5] = 0x01; // Количество регистров для чтения (1 регистр = 2 байта данных)
        
        // Считаем контрольную сумму от первых 6 байт пакета
        const crc = this.crc16(request.subarray(0, 6));
        request[6] = crc & 0xFF;        // CRC LO
        request[7] = (crc >> 8) & 0xFF; // CRC HI
        return request;
    }

    /**
     * Валидация ответа и извлечение из него 16-битного значения.
     * @param {Uint8Array} response - Буфер ответа от STM32 (строго 7 байт)
     */
    static parseResponse(response) {
        // Контрольная сумма считается по первым 5 байтам: ID + Func + ByteCount + DataHI + DataLO
        const calculatedCrc = this.crc16(response.subarray(0, 5));
        const receivedCrc = response[5] | (response[6] << 8);

        if (calculatedCrc !== receivedCrc) {
            throw new Error("Modbus CRC Mismatch (Ошибка контрольной суммы)");
        }

        // Собираем 16-битное сырое значение из 3 и 4 байта ответа
        const rawValue = (response[3] << 8) | response[4];
        
        // Превращаем в знаковую величину short (Int16), чтобы адекватно обрабатывать отрицательные числа
        return (rawValue & 0x8000) ? rawValue - 0x10000 : rawValue;
    }
}