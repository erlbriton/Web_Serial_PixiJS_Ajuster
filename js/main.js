// js/main.js
import { IniParser } from './iniParser.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { SerialConnection } from './serial/serial.js';
import { initUI } from './ui/uiManager.js';

// Импорты логики
import { showIdModal } from './ui.js';
import { updateDeviceRegisters } from './serial/device_updater.js';
import { setupFileHandling } from './file-loader.js';
import { 
    updateComInterfaceName, 
    executeDeviceIdentification, 
    readLoop 
} from './serial-actions.js';

const iniParser = new IniParser();
const appState = { isIdentifying: false, isPolling: false, isRefreshing: false, slaveAddress: 0x01, parser: iniParser };

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Инициализация "Ядра"
        const view = new PixiOscilloscope("osc-container");
        const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
        const serial = new SerialConnection();
        const parser = new ModbusParser(); // Предполагается, что класс доступен глобально или импортирован

        // Передача "Ядра" в UI Manager
        initUI({
            serial, appState, parser, view, buffers,
            setupFileHandling, 
            updateComInterfaceName, 
            executeDeviceIdentification, 
            readLoop, 
            showIdModal, 
            updateDeviceRegisters
        });

        console.log("Приложение запущено.");
    } catch (error) {
        console.error("Критическая ошибка инициализации:", error.message);
    }
});