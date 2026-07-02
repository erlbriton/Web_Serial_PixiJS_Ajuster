import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';

// Внутреннее состояние таймингов опроса осциллографа
let lastPacketTime = 0;
let lastLogTime = 0;

/**
 * Метод безопасного извлечения информации о COM-чипе
 */
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

/**
 * Сценарий опроса ID устройства (Команда 0x11)
 */
export async function executeDeviceIdentification(serial, comSelect, stateObj) {
    try {
        stateObj.isIdentifying = true; 
        await serial.connect(115200);
        
        const chipName = updateComInterfaceName(serial, comSelect);
        
        console.log("[ЖЕЛЕЗО] Порт открыт. Ждем стабилизации UART (500мс)...");
        await new Promise(r => setTimeout(r, 500));

        showIdModal("Запрос ID устройства...");
        
        const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
        await serial.write(packet);
        console.log("Команда ID с правильным CRC отправлена. Ожидаем ответ...");

        let reply = [];
        const startTime = Date.now();
        
        while (Date.now() - startTime < 1500) {
            const chunk = await serial.readChunk();
            if (chunk && chunk.length > 0) {
                console.log("Получен чанк из端口:", Array.from(chunk));
                for (let i = 0; i < chunk.length; i++) {
                    reply.push(chunk[i]);
                }
                
                if (reply.length >= 3) {
                    const dataLength = reply[2]; 
                    const expectedTotalLength = 3 + dataLength + 2; 
                    
                    if (reply.length >= expectedTotalLength || (reply[1] === 0x11 && reply.length >= 52)) {
                        console.log("Пакет ID полностью собран (с учетом коррекции длины)!");
                        break;
                    }
                }
            }
            await new Promise(r => setTimeout(r, 20));
        }

        if (reply.length >= 3) {
            const dataLength = reply[2];
            let idText = "";
            const endOfData = Math.min(3 + dataLength, reply.length - 2);
            
            for (let i = 3; i < endOfData; i++) {
                if (reply[i] >= 32) {
                    idText += String.fromCharCode(reply[i]);
                }
            }
            idText = idText.trim();
            
            console.log("=========================================");
            console.log("УСПЕШНО СЧИТАН ID УСТРОЙСТВА:", idText);
            console.log("=========================================");

            updateIdBanner(idText);
            closeIdModal();
        } else {
            console.warn("Устройство всё еще молчит. Получено байт:", reply.length);
            showIdModal("Ошибка: Нет ответа от устройства (Timeout)");
        }

    } catch (error) {
        console.error("Ошибка внутри обработчика кнопки ID:", error.message);
        showIdModal("Ошибка: " + error.message);
    } finally {
        stateObj.isIdentifying = false; 
    }
}

/**
 * Асинхронный цикл ЧТЕНИЯ потока данных осциллографа
 */
export async function readLoop(serial, parser, view, buffers, stateObj) {
    while (serial.isConnected && stateObj.isPolling) {
        const chunk = await serial.readChunk();
        if (!chunk) break;
        parser.appendData(chunk);
        let packetData = parser.parsePacket();
        while (packetData !== null) {
            handleValidPacket(packetData, view, buffers);
            packetData = parser.parsePacket();
        }
    }
}

/**
 * Асинхронный цикл ЗАПИСИ (запросы 0x03) для осциллографа.
 * Использует динамические параметры из объекта состояния.
 */
export async function writeLoop(serial, stateObj) {
    while (serial.isConnected && stateObj.isPolling) {
        // Читаем актуальные значения адреса и регистра прямо из stateObj на каждой итерации
        const body = new Uint8Array([
            stateObj.slaveAddress, 0x03, 
            (stateObj.registerAddr >> 8) & 0xFF, stateObj.registerAddr & 0xFF, 
            0x00, 0x46 
        ]);
        
        // Расчет контрольной суммы CRC-16 Modbus
        let crc = 0xFFFF;
        for (let pos = 0; pos < body.length; pos++) {
            crc ^= body[pos];
            for (let i = 8; i !== 0; i--) {
                if ((crc & 0x0001) !== 0) { 
                    crc >>= 1; 
                    crc ^= 0xA001; 
                } else { 
                    crc >>= 1; 
                }
            }
        }
        
        // Формирование финального 8-байтового пакета
        const finalPacket = new Uint8Array(8);
        finalPacket.set(body, 0);
        finalPacket[6] = crc & 0xFF;        // Младший байт CRC
        finalPacket[7] = (crc >> 8) & 0xFF; // Старший байт CRC

        // Отправка в порт и пауза в 20мс перед следующим запросом
        await serial.write(finalPacket);
        await new Promise(res => setTimeout(res, 20));
    }
}

/**
 * Обработка валидного пакета данных и перерисовка PIXI-осциллографа
 */
function handleValidPacket(packetData, view, buffers) {
    if (!Array.isArray(packetData)) return;
    const now = performance.now();
    if (lastPacketTime !== 0) {
        if (now - lastLogTime > 1000) {
            console.log("Последний интервал: " + Math.round(now - lastPacketTime) + " мс");
            lastLogTime = now;
        }
    }
    lastPacketTime = now;
    for (let i = 0; i < 70; i++) {
        buffers[i].push(packetData[i] || 0);
    }
    view.draw(buffers); 
}