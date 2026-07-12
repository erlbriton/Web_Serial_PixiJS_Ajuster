// serial.ts - Изолированный драйвер низкоуровневой работы с COM-портам

// Если IDE ругается на navigator.serial, это значит, что у вас в tsconfig в "lib" 
// нужно добавить "DOM". Это должно быть уже сделано в вашем файле.
 
// --- Исправление типизации для Web Serial API ---
interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
}
// -------------------------------------------------

export class SerialConnection {
    private port: SerialPort | null;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null;
    private readableStream: ReadableStream<Uint8Array> | null;
    public isConnected: boolean;

    constructor() {
        this.port = null;
        this.reader = null;
        this.readableStream = null;
        this.isConnected = false;
    }

    /**
     * Запрос разрешения у пользователя и открытие физического COM-порта.
     * @param {number} baudRate - Скорость подключения
     */
    async connect(baudRate: number = 115200): Promise<void> {
        if (!('serial' in navigator)) {
            throw new Error("Ваш браузер не поддерживает Web Serial API. Используйте Chrome или Edge.");
        }

        try {
            // Типизируем запрос порта
            this.port = await (navigator.serial as any).requestPort();
            
            // Открываем порт на заданной скорости
            await this.port!.open({ baudRate: baudRate });
            
            this.readableStream = this.port!.readable;
            this.reader = this.readableStream!.getReader();
            this.isConnected = true;
            
            console.log(`[Serial] Порт успешно открыт на скорости ${baudRate} бод.`);
        } catch (error: any) {
            this.isConnected = false;
            this.port = null;
            this.reader = null;
            throw new Error(`Ошибка подключения к порту: ${error.message}`);
        }
    }

    /**
     * Асинхронное чтение очередной порции сырых байт из буфера
     */
    async readChunk(): Promise<Uint8Array | null> {
        if (!this.isConnected || !this.reader) return null;
        try {
            const { value, done } = await this.reader.read();
            if (done) {
                this.release();
                return null;
            }
            return value; 
        } catch (error: any) {
            console.error("[Serial] Ошибка критического чтения из порта:", error.message);
            this.release();
            throw error;
        }
    }

    /**
     * Отправка массива байт в сторону устройства (Slave)
     */
    async write(data: Uint8Array): Promise<void> {
        if (!this.isConnected || !this.port || !this.port.writable) return;
        
        const writer = this.port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
    }

    /**
     * Корректное освобождение ресурсов
     */
    release(): void {
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