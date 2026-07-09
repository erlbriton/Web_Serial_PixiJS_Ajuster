import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';
import { currentDeviceConfig } from './ini-manager/tree-core.js';
import { calculateRamRange } from './oscilloscope/ringBuffer.js';

let lastPacketTime = 0;
let currentLoopId = 0; 

// === ЦЕНТРАЛЬНЫЙ МЕНЕДЖЕР ПОРТА (АРХИТЕКТУРА «ЕДИНЫЙ ЧИТАТЕЛЬ») ===
class SerialManager {
    constructor() {
        this.serial = null;
        this.readerPromise = null;
        this.currentHandler = null;
        this.lock = Promise.resolve();
    }

    init(serial) {
        this.serial = serial;
        this.startReader();
    }

    startReader() {
        if (this.readerPromise || !this.serial || !this.serial.isConnected) return;
        
        this.readerPromise = (async () => {
            console.log("[SerialManager] Центральный единый ридер успешно запущен.");
            while (this.serial && this.serial.isConnected) {
                try {
                    const chunk = await this.serial.readChunk();
                    if (chunk && chunk.length > 0) {
                        if (this.currentHandler) {
                            this.currentHandler(chunk);
                        }
                    } else {
                        // Кратковременная пауза при пустом чанке, чтобы не перегружать CPU
                        await new Promise(r => setTimeout(r, 5));
                    }
                } catch (e) {
                    console.error("[SerialManager] Критическая ошибка в едином ридере:", e);
                    break;
                }
            }
            this.readerPromise = null;
            console.log("[SerialManager] Центральный единый ридер остановлен.");
        })();
    }

    async executeTransaction(packet, checkCompleteFn, timeoutMs = 1000) {
        // Строгая атомарная очередь запросов через Промис-Лок (Мьютекс)
        const oldLock = this.lock;
        let release;
        this.lock = new Promise(r => release = r);
        await oldLock;

        try {
            this.startReader(); // Гарантируем работу ридера перед отправкой

            await this.serial.write(packet);

            return await new Promise((resolve) => {
                let buffer = new Uint8Array(0);
                let timeoutId = null;

                const cleanUp = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (this.currentHandler === handleChunk) {
                        this.currentHandler = null;
                    }
                };

                const handleChunk = (chunk) => {
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

                timeoutId = setTimeout(() => {
                    cleanUp();
                    resolve(buffer); // Возвращаем накопленное по таймауту, если устройство не успело
                }, timeoutMs);
            });
        } catch (err) {
            console.error("[SerialManager] Ошибка транзакции:", err);
            throw err;
        } finally {
            release();
        }
    }
}

export const serialManager = new SerialManager();

// Временный мост для обратной совместимости с неотрефакторенным device_updater.js.
// Перенаправляет старые одиночные вызовы чтения на центральный поток данных ридера, исключая "зомби-промисы".
export const readWithTimeout = (serial, ms) => {
    return new Promise((resolve) => {
        let timeoutId = setTimeout(() => {
            if (serialManager.currentHandler === handleTemp) {
                serialManager.currentHandler = null;
            }
            resolve(null);
        }, ms);

        const handleTemp = (chunk) => {
            clearTimeout(timeoutId);
            if (serialManager.currentHandler === handleTemp) {
                serialManager.currentHandler = null;
            }
            resolve(chunk);
        };

        serialManager.currentHandler = handleTemp;
    });
};

export function calculateCRC(buffer) {
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

export function updateComInterfaceName(serial, comSelect) {
    if (!comSelect) return;
    const portInfo = (serial.port && typeof serial.port.getInfo === 'function') 
        ? serial.port.getInfo() 
        : (typeof serial.getInfo === 'function' ? serial.getInfo() : {});
    const chipName = identifyUsbChip(portInfo);
    comSelect.innerHTML = `<option value="active">${chipName}</option>`;
    comSelect.className = 'select-blue';
    return chipName;
}

export async function executeDeviceIdentification(serial, comSelect, stateObj) {
    try {
        stateObj.isIdentifying = true; 
        await serial.connect(115200);
        serialManager.init(serial);
        
        const chipName = updateComInterfaceName(serial, comSelect);
        await new Promise(r => setTimeout(r, 500));
        showIdModal("Запрос ID устройства...");
        
        const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
        
        const checkComplete = (buf) => {
            if (buf.length >= 3) {
                const dataLength = buf[2]; 
                return buf.length >= 3 + dataLength + 2 || buf.length >= 52;
            }
            return false;
        };

        const reply = await serialManager.executeTransaction(packet, checkComplete, 1500);

        if (reply && reply.length >= 3) {
            const dataLength = reply[2];
            let idText = "";
            for (let i = 3; i < Math.min(3 + dataLength, reply.length - 2); i++) {
                if (reply[i] >= 32) idText += String.fromCharCode(reply[i]);
            }
            updateIdBanner(idText.trim());
            closeIdModal();
        } else {
            showIdModal("Ошибка: Нет ответа от устройства");
        }
    } catch (error) {
        showIdModal("Ошибка: " + error.message);
    } finally {
        stateObj.isIdentifying = false; 
    }
}

export async function readLoop(serial, parser, view, buffers, stateObj) {
    // Проверка наличия конфига
    if (!currentDeviceConfig || !currentDeviceConfig['RAM']) {
        console.error("[LOOP] Конфигурация RAM не загружена. Остановка цикла.");
        return; 
    }

    // Динамический расчет адреса и количества регистров из INI
    const ramSection = currentDeviceConfig['RAM'];
    const { start, count } = calculateRamRange(ramSection);
    
    const loopId = ++currentLoopId; 
    console.log(`[LOOP] Старт цикла #${loopId}. Читаем RAM: от 0x${start.toString(16)} по ${count} рег.`);
    
    serialManager.init(serial);

    while (serial.isConnected && stateObj.isPolling && !stateObj.isRefreshing) {
        if (loopId !== currentLoopId) return; 

        // Формируем пакет с динамическими данными
        const body = new Uint8Array([
            stateObj.slaveAddress, 0x03, 
            (start >> 8) & 0xFF, start & 0xFF, 
            (count >> 8) & 0xFF, count & 0xFF 
        ]);
        
        const crc = calculateCRC(body);
        const finalPacket = new Uint8Array(8);
        finalPacket.set(body, 0);
        finalPacket[6] = crc & 0xFF;
        finalPacket[7] = (crc >> 8) & 0xFF;

        // Динамический критерий полноты ответа (3 байта заголовок + данные + 2 байта CRC)
        const expectedBytes = 3 + (count * 2) + 2;
        const checkComplete = (buf) => buf.length >= expectedBytes;

        try {
            const reply = await serialManager.executeTransaction(finalPacket, checkComplete, 100);
            
            if (loopId !== currentLoopId) return; 
            if (!stateObj.isPolling || stateObj.isRefreshing) break; 
            
            if (reply && reply.length > 0) {
                parser.appendData(reply);
                let packetData = parser.parsePacket();
                while (packetData !== null) {
                    if (packetData.length >= count) {
                        handleValidPacket(packetData, view, buffers);
                    }
                    packetData = parser.parsePacket();
                }
            }
        } catch (err) {
            console.error("[LOOP] Транзакция осциллографа прервана:", err);
        }

        await new Promise(res => setTimeout(res, 20));
    }
    console.log(`[LOOP] Цикл #${loopId} корректно остановлен.`);
}

export async function writeLoop(serial, stateObj) {
    // В новой архитектуре отправка запросов и чтение ответов объединены в атомарную транзакцию внутри readLoop.
    // Этот метод сознательно оставлен пустым, чтобы не создавать параллельный спам в порт и не нарушать вызовы в main.js.
}

function handleValidPacket(packetData, view, buffers) {
    if (!Array.isArray(packetData)) return;
    for (let i = 0; i < 70; i++) {
        buffers[i].push(packetData[i] || 0);
    }
    view.draw(buffers); 
}