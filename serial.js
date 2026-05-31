// serial.js
class SerialConnection {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
    }

    // Запрос прав у пользователя и открытие порта на скорости 115200
    async open() {
        // Браузер покажет системное окно со списком COM-портов
        this.port = await navigator.serial.requestPort();
        
        // Открываем порт с запасом буферизации на стороне Windows (4 КБ)
        await this.port.open({ baudRate: 115200, bufferSize: 4096 });
        
        // Получаем низкоуровневые потоки чтения и записи байт
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
    }

    // Отправка сырого массива байт (Uint8Array) в STM32
    async send(bytes) {
        if (!this.writer) return;
        await this.writer.write(bytes);
    }

    /**
     * Чтение пакета строго фиксированной длины с защитой от подвисания потока.
     * @param {number} size - Сколько байт ожидает Modbus-парсер (для чтения 1 регистра это 7 байт)
     * @param {number} timeoutMs - Предельное время ожидания ответа в миллисекундах
     */
    async readExact(size, timeoutMs = 25) {
        const buffer = new Uint8Array(size);
        let readBytes = 0;
        const start = performance.now();

        while (readBytes < size) {
            // Проверка: если физически вышли за лимит таймаута внутри цикла
            if ((performance.now() - start) > timeoutMs) {
                throw new Error("Timeout: предел времени ожидания байт превышен");
            }

            // Организуем "гонку": либо данные приходят из порта, либо срабатывает таймер сброса
            const { value, done } = await Promise.race([
                this.reader.read(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
            ]);

            if (done) break;

            if (value) {
                // Копируем пришедший кусок данных в наш итоговый буфер ответа
                const chunkSpace = Math.min(value.length, size - readBytes);
                buffer.set(value.subarray(0, chunkSpace), readBytes);
                readBytes += chunkSpace;
            }
        }
        return buffer;
    }
}