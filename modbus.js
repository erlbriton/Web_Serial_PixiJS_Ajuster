// modbus.js - Изолированный парсер протокола Modbus RTU

class ModbusParser {
    constructor() {
        // Внутренний буфер накопления приходящих байт
        this.buffer = new Uint8Array(0);
    }

    /**
     * Метод принимает порцию сырых байт от COM-порта и добавляет их в конец буфера накопления
     * @param {Uint8Array} chunk - Новые байты из порта
     */
    appendData(chunk) {
        if (!chunk || chunk.length === 0) return;
        
        // Выделяем новую память под объединенный массив байт
        const newBuffer = new Uint8Array(this.buffer.length + chunk.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(chunk, this.buffer.length);
        this.buffer = newBuffer;
    }

    /**
     * Ищет и извлекает один валидный пакет Modbus RTU из накопленного буфера.
     * Мы парсим стандартную функцию 03 (Read Holding Registers) или 04 (Read Input Registers).
     * Ответ STM32 обычно выглядит так: [Адрес](1б) + [Функция](1б) + [Кол-во байт данных](1б) + [Данные](Nб) + [CRC](2б)
     * @returns {number|null} Возвращает декодированное число (значение АЦП) или null, если пакета еще нет
     */
    parsePacket() {
        // Минимальный размер ответа Modbus (например, для 1 регистра: 1 + 1 + 1 + 2 + 2 = 7 байт)
        const MIN_PACKET_LENGTH = 7;

        while (this.buffer.length >= MIN_PACKET_LENGTH) {
            // Ищем маркер начала пакета. Допустим, адрес нашего STM32 равен 0x01, а функция 0x04
            if (this.buffer[0] === 0x01 && (this.buffer[1] === 0x04 || this.buffer[1] === 0x03)) {
                
                const bytesOfData = this.buffer[2]; // Сколько байт данных нам прислал контроллер
                const fullPacketLength = 3 + bytesOfData + 2; // Шапка(3б) + Данные + CRC(2б)

                // Если весь пакет целиком еще не дополз по USB — прерываемся и ждем следующий кусок
                if (this.buffer.length < fullPacketLength) {
                    return null;
                }

                // Вырезаем пакет для проверки контрольной суммы CRC16
                const packet = this.buffer.subarray(0, fullPacketLength);
                
                if (this.calculateCRC(packet.subarray(0, fullPacketLength - 2)) === (packet[fullPacketLength - 1] << 8 | packet[fullPacketLength - 2])) {
                    // Пакет валиден! Извлекаем значение ПЕРВОГО регистра (байты 3 и 4)
                    const highByte1 = packet[3];
                    const lowByte1 = packet[4];
                    const adcValue1 = (highByte1 << 8) | lowByte1;

                    // Извлекаем значение ВТОРОГО регистра (байты 5 и 6)
                    const highByte2 = packet[5];
                    const lowByte2 = packet[6];
                    const adcValue2 = (highByte2 << 8) | lowByte2;

                    // Очищаем буфер от обработанного пакета
                    this.buffer = this.buffer.subarray(fullPacketLength);
                    
                    // Возвращаем оба значения в виде массива для main.js
                    return [adcValue1, adcValue2];
                } else {
                    // CRC не совпал — данные побились. Сдвигаем буфер на 1 байт вперед, чтобы искать новый маркер
                    this.buffer = this.buffer.subarray(1);
                }
            } else {
                // Первый байт — не наш адрес. Сбрасываем его и ищем дальше
                this.buffer = this.buffer.subarray(1);
            }
        }

        return null;
    }

    /**
     * Стандартный алгоритм подсчета контрольной суммы Modbus CRC16
     */
    calculateCRC(buffer) {
        let crc = 0xFFFF;
        for (let pos = 0; pos < buffer.length; pos++) {
            crc ^= buffer[pos];
            for (let i = 8; i !== 0; i--) {
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
}