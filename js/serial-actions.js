import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';

let lastPacketTime = 0;
let lastLogTime = 0;
let currentLoopId = 0; 

// Самый быстрый "readWithTimeout"
export const readWithTimeout = (serial, ms) => {
    return Promise.race([
        serial.readChunk(),
        new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);
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
        const chipName = updateComInterfaceName(serial, comSelect);
        await new Promise(r => setTimeout(r, 500));
        showIdModal("Запрос ID устройства...");
        const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
        await serial.write(packet);
        let reply = [];
        const startTime = Date.now();
        while (Date.now() - startTime < 1500) {
            const chunk = await serial.readChunk();
            if (chunk && chunk.length > 0) {
                for (let i = 0; i < chunk.length; i++) reply.push(chunk[i]);
                if (reply.length >= 3) {
                    const dataLength = reply[2]; 
                    if (reply.length >= 3 + dataLength + 2 || (reply[1] === 0x11 && reply.length >= 52)) break;
                }
            }
            await new Promise(r => setTimeout(r, 20));
        }
        if (reply.length >= 3) {
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
    const loopId = ++currentLoopId; 
    console.log(`[LOOP] Старт цикла #${loopId}`);

    while (serial.isConnected && stateObj.isPolling) {
        if (loopId !== currentLoopId) return; 

        // 50мс таймаут для осциллографа - комфортно
        const chunk = await readWithTimeout(serial, 50);
        
        if (loopId !== currentLoopId) return; 
        if (!stateObj.isPolling) break; 
        if (!chunk) continue;
        
        parser.appendData(chunk);
        let packetData = parser.parsePacket();
        while (packetData !== null) {
            if (packetData.length >= 70) {
                handleValidPacket(packetData, view, buffers);
            }
            packetData = parser.parsePacket();
        }
    }
    console.log(`[LOOP] Цикл #${loopId} корректно остановлен.`);
}

export async function writeLoop(serial, stateObj) {
    const loopId = currentLoopId;
    while (serial.isConnected && stateObj.isPolling) {
        if (loopId !== currentLoopId) return;

        const body = new Uint8Array([
            stateObj.slaveAddress, 0x03, 
            (stateObj.registerAddr >> 8) & 0xFF, stateObj.registerAddr & 0xFF, 
            0x00, 0x46 
        ]);
        const crc = calculateCRC(body);
        const finalPacket = new Uint8Array(8);
        finalPacket.set(body, 0);
        finalPacket[6] = crc & 0xFF;
        finalPacket[7] = (crc >> 8) & 0xFF;

        await serial.write(finalPacket);
        
        if (loopId !== currentLoopId) return;
        await new Promise(res => setTimeout(res, 20));
        if (loopId !== currentLoopId) return;
    }
}

function handleValidPacket(packetData, view, buffers) {
    if (!Array.isArray(packetData)) return;
    const now = performance.now();
    lastPacketTime = now;
    for (let i = 0; i < 70; i++) {
        buffers[i].push(packetData[i] || 0);
    }
    view.draw(buffers); 
}