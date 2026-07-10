// js/main.js
import { IniParser } from './iniParser.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { SerialConnection } from './serial/serial.js';
import { initUI } from './ui/uiManager.js';
import { createOscilloscopeView } from './views/oscilloscopeView.js';
import { PixiOscilloscope } from './oscilloscope/pixiOscilloscope.js';

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
        const oscContainer = document.getElementById('osc-container');
        // ВАЖНО: Мы НЕ делаем oscContainer.classList.remove('hidden') здесь!
        // График создастся в скрытом контейнере, но не будет ломать верстку.
        if (oscContainer) {
            oscContainer.appendChild(createOscilloscopeView());
        }

        const view = new PixiOscilloscope('osc-canvas-container');
        const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
        
        // Экспортируем view в глобальную область или делаем доступным для uiManager
        window.oscView = view;
        const serial = new SerialConnection();
        const parser = new ModbusParser();

        initUI({
            serial, appState, parser, view, buffers,
            setupFileHandling, 
            updateComInterfaceName, 
            executeDeviceIdentification, 
            readLoop, 
            showIdModal, 
            updateDeviceRegisters
        });

        console.log("Приложение запущено. Осциллограф скрыт до клика.");
    } catch (error) {
        console.error("Критическая ошибка:", error.message);
    }
});