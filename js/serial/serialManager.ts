// js/serial/serialManager.ts

class SerialManager {
    private serial: any = null;
    private readerPromise: Promise<void> | null = null;
    public currentHandler: ((chunk: Uint8Array) => void) | null = null;
    private lock: Promise<void> = Promise.resolve();

    init(serial: any): void {
        this.serial = serial;
        this.startReader();
    }

    private startReader(): void {
        if (this.readerPromise || !this.serial || !this.serial.isConnected) return;
        
        this.readerPromise = (async () => {
            console.log("[SerialManager] Центральный единый ридер успешно запущен.");
            while (this.serial && this.serial.isConnected) {
                try {
                    const chunk = await this.serial.readChunk();
                    if (chunk && chunk.length > 0) {
                        this.currentHandler?.(chunk);
                    } else {
                        await new Promise(r => setTimeout(r, 5));
                    }
                } catch (e) {
                    console.error("[SerialManager] Критическая ошибка:", e);
                    break;
                }
            }
            this.readerPromise = null;
        })();
    }

    async executeTransaction(packet: Uint8Array, checkCompleteFn: (buf: Uint8Array) => boolean, timeoutMs = 1000): Promise<Uint8Array> {
        const oldLock = this.lock;
        let release!: () => void;
        this.lock = new Promise(r => release = r);
        await oldLock;

        try {
            this.startReader();
            await this.serial.write(packet);

            return await new Promise((resolve) => {
                let buffer = new Uint8Array(0);
                let timeoutId: any = null;

                const cleanUp = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (this.currentHandler === handleChunk) this.currentHandler = null;
                };

                const handleChunk = (chunk: Uint8Array) => {
                    let newBuffer = new Uint8Array(buffer.length + chunk.length);
                    newBuffer.set(buffer);
                    newBuffer.set(chunk, buffer.length);
                    buffer = newBuffer;

                    if (checkCompleteFn(buffer)) {
                        cleanUp();
                        resolve(buffer);
                    }
                };

                this.currentHandler = handleChunk;
                timeoutId = setTimeout(() => { cleanUp(); resolve(buffer); }, timeoutMs);
            });
        } finally {
            release();
        }
    }
}

export const serialManager = new SerialManager();