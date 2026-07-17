// js/main.ts
import { initUI } from './ui/uiManager.js';
import { setupFileHandling } from './file-loader.js';
import { IniParser } from './iniParser.js';
import { MonitorModel } from './model/monitorModel.js';
import { MonitorRow } from './model/monitorRow.js';
import { MonitorSignal } from './model/monitorSignal.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { PixiOscilloscope } from './oscilloscope/pixiOscilloscope.js';
import { createOscilloscopeView } from './views/oscilloscopeView.js';

// Глобальное состояние приложения
const appState = {
    parser: new IniParser(),
    currentDeviceConfig: null as any
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Создаем представление осциллографа
    const oscView = createOscilloscopeView();
    document.body.appendChild(oscView);

    // 2. Инициализация начальной модели (до загрузки INI)
    const initialModel = new MonitorModel();
    const ramParameters = appState.parser.getSectionParameters('RAM');
    
    for (const param of ramParameters) {
        const regAddressNum = parseInt(param.regAddress, 10);
        const multiplierNum = parseFloat(param.multiplier.replace(',', '.'));
        
        const signal: MonitorSignal = {
            id: param.hexAddress || param.name,
            name: param.name,
            description: param.description,
            dataType: param.dataType,
            register: isNaN(regAddressNum) ? 0 : regAddressNum,
            unit: param.unit,
            multiplier: isNaN(multiplierNum) ? 1.0 : multiplierNum,
            buffer: new RingBuffer(2500),
            currentValue: 0
        };
        
        initialModel.addRow(new MonitorRow(signal));
    }
    
    // Сохраняем как глобальный источник истины
    (window as any).oscModel = initialModel;
    console.log(`✅ DEBUG: Начальная MonitorModel создана. Строк: ${initialModel.rowCount}`);

    // 3. Создаем PixiOscilloscope с новой архитектурой (передаем МОДЕЛЬ)
    const view = new PixiOscilloscope('osc-canvas-container', initialModel);
    (window as any).oscView = view;
    
    // Временный мостик для старого кода
    const tempBuffers = initialModel.rows.map(row => row.signal.buffer);

    // 4. Настройка обработчиков файлов
    const fileInput = document.getElementById('ini-file-input') as HTMLInputElement;
    if (fileInput) {
        setupFileHandling(fileInput, appState, view, tempBuffers);
    }

    // 5. Запуск UI менеджера с ТОЧНЫМ соответствием реальным сигнатурам UIDependencies
    initUI({
        serial: {} as any, 
        appState, 
        parser: appState.parser, 
        view, 
        buffers: tempBuffers, 
        setupFileHandling, 
        updateComInterfaceName: (serial: any, select: HTMLSelectElement | null) => undefined, 
        executeDeviceIdentification: async (serial: any, select: HTMLSelectElement | null, state: any) => {
            /* заглушка Promise<void> */
        }, 
        readLoop: (serial: any, parser: any, view: any, buffers: any, state: any) => {}, 
        showIdModal: (msg: string) => alert(msg), 
        updateDeviceRegisters: async (serial: any, addr: number, state: any) => {
            return false; // Явный возврат boolean для Promise<boolean>
        }
    });
});