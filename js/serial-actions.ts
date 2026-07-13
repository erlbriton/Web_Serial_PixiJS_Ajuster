// js/device_updater.ts
import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';
import { calculateRamRange } from './oscilloscope/ringBuffer.js';

let currentLoopId = 0; 

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

export function calculateCRC(buffer: Uint8Array): number {
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

export function updateComInterfaceName(serial: any, comSelect: HTMLSelectElement | null): string | undefined {
    if (!comSelect) return;
    const portInfo = (serial.port?.getInfo?.()) || (typeof serial.getInfo === 'function' ? serial.getInfo() : {});
    const chipName = identifyUsbChip(portInfo);
    comSelect.innerHTML = `<option value="active">${chipName}</option>`;
    comSelect.className = 'select-blue';
    return chipName;
}

export async function executeDeviceIdentification(serial: any, comSelect: HTMLSelectElement | null, stateObj: any): Promise<void> {
    try {
        stateObj.isIdentifying = true; 
        await serial.connect(115200);
        serialManager.init(serial);
        
        updateComInterfaceName(serial, comSelect);
        await new Promise(r => setTimeout(r, 500));
        showIdModal("Запрос ID устройства...");
        
        const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
        const checkComplete = (buf: Uint8Array) => buf.length >= 3 && buf.length >= 3 + buf[2] + 2;

        const reply = await serialManager.executeTransaction(packet, checkComplete, 1500);

        if (reply && reply.length >= 3) {
            let idText = Array.from(reply.slice(3, 3 + reply[2]))
                .map(b => b >= 32 ? String.fromCharCode(b) : "").join("");
            updateIdBanner(idText.trim());
            closeIdModal();
        } else {
            showIdModal("Ошибка: Нет ответа");
        }
    } catch (error: any) {
        showIdModal("Ошибка: " + error.message);
    } finally {
        stateObj.isIdentifying = false; 
    }
}

export async function readLoop(serial: any, parser: any, view: any, buffers: any[], stateObj: any): Promise<void> {
    // ИСПРАВЛЕНИЕ: здесь используем stateObj
    console.log("[readLoop] Функция вызвана. stateObj.isPolling:", stateObj.isPolling);
    
    const deviceConfig = stateObj.currentDeviceConfig; // Используем stateObj
    if (!deviceConfig?.['RAM']) return;

    const { start, count } = calculateRamRange(deviceConfig['RAM']);
    const loopId = ++currentLoopId; 
    serialManager.init(serial);

    // ИСПРАВЛЕНИЕ: используем stateObj вместо appState во всех проверках
    while (serial.isConnected && stateObj.isPolling && !stateObj.isRefreshing) {
        if (loopId !== currentLoopId) return; 

        const body = new Uint8Array([
            stateObj.slaveAddress, 0x03, 
            (start >> 8) & 0xFF, start & 0xFF, 
            (count >> 8) & 0xFF, count & 0xFF 
        ]);
        
        const crc = calculateCRC(body);
        const finalPacket = new Uint8Array([ ...body, crc & 0xFF, (crc >> 8) & 0xFF ]);

        try {
            const reply = await serialManager.executeTransaction(finalPacket, (buf) => buf.length >= 3 + (count * 2) + 2, 100);
            
            // ИСПРАВЛЕНИЕ: используем stateObj
            if (loopId !== currentLoopId || !stateObj.isPolling || stateObj.isRefreshing) break; 
            
            if (reply?.length > 0) {
                parser.appendData(reply);
                let packetData = parser.parsePacket();
                while (packetData !== null) {
                    if (packetData.length >= count) handleValidPacket(packetData, view, buffers);
                    packetData = parser.parsePacket();
                }
            }
        } catch (err) { console.error(err); }
        await new Promise(res => setTimeout(res, 20));
    }
}
function handleValidPacket(packetData: number[], view: any, buffers: any[]): void {
    for (let i = 0; i < 70; i++) {
        buffers[i]?.push(packetData[i] || 0);
    }
    view.draw(buffers); 
}