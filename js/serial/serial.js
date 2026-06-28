// serial.js - Изолированный драйвер низкоуровневой работы с COM-портом

class SerialConnection {
    constructor() {
        this.port = null;
        this.reader = null;
        this.readableStream = null;
        this.isConnected = false;
    }

    /**
     * Запрос разрешения у пользователя и открытие физического COM-порта.
     * @param {number} baudRate - Скорость подключения (по умолчанию 115200 для STM32)
     */
    async connect(baudRate = 115200) {
        if (!('serial' in navigator)) {
            throw new Error("Ваш браузер не поддерживает Web Serial API. Используйте Chrome или Edge.");
        }

        try {
            // Браузер запрашивает у операционной системы Windows список доступных портов
            this.port = await navigator.serial.requestPort();
            
            // Открываем港 на заданной скорости
            await this.port.open({ baudRate: baudRate });
            
            this.readableStream = this.port.readable;
            this.reader = this.readableStream.getReader();
            this.isConnected = true;
            
            console.log(`[Serial] Порт успешно открыт на скорости ${baudRate} бод.`);
        } catch (error) {
            this.isConnected = false;
            this.port = null;
            this.reader = null;
            throw new Error(`Ошибка подключения к порту: ${error.message}`);
        }
    }

    /**
     * Асинхронное чтение очередной порции сырых байт из буфера Windows
     * @returns {Promise<Uint8Array|null>} Массив считанных байт или null, если чтение завершено
     */
    async readChunk() {
        if (!this.isConnected || !this.reader) return null;
        try {
            const { value, done } = await this.reader.read();
            if (done) {
                this.release();
                return null;
            }
            return value; // Возвращаем Uint8Array со свежими байтами
        } catch (error) {
            console.error("[Serial] Ошибка критического чтения из порта:", error.message);
            this.release();
            throw error;
        }
    }

    /**
     * Отправка массива байт (запроса Мастера) в сторону устройства (Slave)
     * @param {Uint8Array} data - Массив байт запроса Modbus RTU
     */
    async write(data) {
        if (!this.isConnected || !this.port || !this.port.writable) return;
        
        const writer = this.port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock(); // Мгновенно освобождаем поток записи для следующих циклов опроса
    }

    /**
     * Корректное освобождение ресурсов при закрытии порта или отключении кабеля
     */
    release() {
        this.isConnected = false;
        try { 
            if (this.reader) {
                this.reader.releaseLock(); 
            }
        } catch(e) {}
        this.reader = null;
        this.port = null;
    }
}