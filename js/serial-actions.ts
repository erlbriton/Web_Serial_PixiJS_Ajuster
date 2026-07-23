// js/serial-actions.ts
import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';
import { serialManager } from './serial/serialManager.js';

// Реэкспортируем всё, что запрашивают другие модули
export { readLoop, calculateCRC } from './handlers/readLoop.js';
export { serialManager };

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