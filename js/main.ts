// js/main.ts
import { IniParser } from './iniParser.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { SerialConnection } from './serial/serial.js';
import { initUI } from './ui/uiManager.js';
import { initLayout } from './ui/layout'; // Пробуем этот путь
import { createOscilloscopeView } from './views/oscilloscopeView.js';
import { PixiOscilloscope } from './oscilloscope/pixiOscilloscope.js';
import { ModbusParser } from './serial/modbus.js';

import { showIdModal } from './ui.js';
import { updateDeviceRegisters } from './serial/device_updater.js';
import { setupFileHandling } from './file-loader.js';
import { 
    updateComInterfaceName, 
    executeDeviceIdentification, 
    readLoop 
} from './serial-actions.js';

// Расширяем глобальный объект window для TypeScript
declare global {
    interface Window {
        oscView: PixiOscilloscope;
    }
}

// Создаем явный интерфейс для AppState, чтобы избежать костыля "null as any"
export interface AppState {
    isIdentifying: boolean;
    isPolling: boolean;
    isRefreshing: boolean;
    slaveAddress: number;
    parser: IniParser;
    currentDeviceConfig: any | null;
}

const iniParser = new IniParser();

const appState: AppState = { 
    isIdentifying: false, 
    isPolling: false, 
    isRefreshing: false, 
    slaveAddress: 0x01, 
    parser: iniParser,
    currentDeviceConfig: null 
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        const oscContainer = document.getElementById('osc-container');
        if (oscContainer) {
            oscContainer.appendChild(createOscilloscopeView());
        }

        // Получаем количество параметров из секции RAM
        const ramParams = iniParser.getSectionParameterKeys('RAM');
        const rowCount = ramParams.length > 0 ? ramParams.length : 1; // Минимум 1 график, если данных пока нет
        
console.log(`DEBUG: Инициализация осциллографа. Параметров в RAM: ${ramParams.length}, создаем графиков: ${rowCount}`);

        const view = new PixiOscilloscope('osc-canvas-container', rowCount);
        const buffers: RingBuffer[] = Array.from({ length: rowCount }, () => new RingBuffer(2500));
        
        window.oscView = view;
        const serial = new SerialConnection();
        const parser = new ModbusParser();

        initUI({
    serial, 
    appState, 
    parser, 
    view, 
    buffers,
    setupFileHandling, 
    updateComInterfaceName, 
    executeDeviceIdentification, 
    readLoop, 
    showIdModal, 
    updateDeviceRegisters
});
initLayout();

        console.log("Приложение запущено. Осциллограф скрыт до клика.");
    } catch (error) {
        // Безопасная обработка ошибки неизвестного типа (unknown)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Критическая ошибка:", errorMessage);
    }
});