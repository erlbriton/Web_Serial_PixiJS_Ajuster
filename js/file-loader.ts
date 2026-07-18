// js/file-loader.ts
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';
import { IniParser } from './iniParser.js';
import { MonitorModel } from './model/monitorModel.js';
import { MonitorRow } from './model/monitorRow.js';
import { MonitorSignal } from './model/monitorSignal.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';

interface AppState {
    iniParser: IniParser;
    parser: IniParser;       // <-- ДОБАВЛЕНО: для совместимости со старым кодом (tree.js, ui.js)
    modbusParser: any;
    currentDeviceConfig: any;
}

export function setupFileHandling(fileInput: HTMLInputElement, appState: AppState, view: any, buffers: any[]) {
    fileInput.addEventListener('change', (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (!target.files) return;
        
        const files = Array.from(target.files);
        if (files.length === 0) return;

        files.forEach((file: File) => {
            const reader = new FileReader();

            reader.onload = (e: ProgressEvent<FileReader>) => {
                try {
                    const content = e.target?.result as string;
                    const config = appState.iniParser.parse(content);

                    if (config['DEVICE']) {
                        appState.currentDeviceConfig = config;

                        const model = new MonitorModel();
                        const ramParams = appState.iniParser.getSectionParameters('RAM');
                        
                        for (const param of ramParams) {
                            const regAddressNum = parseInt(param.regAddress || '0', 10);
                            const multiplierStr = param.multiplier ? param.multiplier.replace(',', '.') : '1';
                            const multiplierNum = parseFloat(multiplierStr);
                            
                            const signal: MonitorSignal = {
                                id: param.hexAddress || param.name || 'unknown',
                                name: param.name || 'unknown',
                                description: param.description || '',
                                dataType: param.dataType || 'TWORD',
                                register: isNaN(regAddressNum) ? 0 : regAddressNum,
                                unit: param.unit || '',
                                multiplier: isNaN(multiplierNum) ? 1.0 : multiplierNum,
                                buffer: new RingBuffer(2500),
                                currentValue: 0
                            };
                            
                            const row = new MonitorRow(signal);
                            row.visible = true; // КРИТИЧНО для отрисовки
                            row.height = 20;    // КРИТИЧНО для отрисовки
                            model.addRow(row);
                        }
                        
                        (window as any).oscModel = model;
                        console.log(`✅ DEBUG: MonitorModel создана. Строк: ${model.rowCount}`);

                        const rowCount = model.rowCount > 0 ? model.rowCount : 1;
                        view.updateRows(rowCount);
                        
                        buffers.length = 0;
                        for (const row of model.rows) {
                            buffers.push(row.signal.buffer);
                        }

                        const isAdded = addDeviceToRegistry(config);
                        if (isAdded) renderDeviceTree(appState, view, buffers);

                        populateDeviceForm(config['DEVICE']);
                        
                        // Эта функция создает таблицу и ресайзеры. 
                        // Теперь она не упадет из-за отсутствия appState.parser
                        renderModbusTable(config);
                        console.log("✅ Таблица и ресайзеры должны быть созданы.");
                    }
                } catch (err) {
                    showIdModal("Ошибка обработки файла: " + file.name);
                    console.error("Parser Error:", err);
                }
            };

            reader.onerror = () => showIdModal("Ошибка чтения файла: " + file.name);
            reader.readAsText(file, 'windows-1251');
        });

        fileInput.value = '';
    });
}

export function refreshOscilloscope(parser: IniParser, view: any, buffers: any[]) {
    const model = new MonitorModel();
    const ramParams = parser.getSectionParameters('RAM');
    
    for (const param of ramParams) {
        const regAddressNum = parseInt(param.regAddress || '0', 10);
        const multiplierStr = param.multiplier ? param.multiplier.replace(',', '.') : '1';
        const multiplierNum = parseFloat(multiplierStr);
        
        const signal: MonitorSignal = {
            id: param.hexAddress || param.name || 'unknown',
            name: param.name || 'unknown',
            description: param.description || '',
            dataType: param.dataType || 'TWORD',
            register: isNaN(regAddressNum) ? 0 : regAddressNum,
            unit: param.unit || '',
            multiplier: isNaN(multiplierNum) ? 1.0 : multiplierNum,
            buffer: new RingBuffer(2500),
            currentValue: 0
        };
        
        const row = new MonitorRow(signal);
        row.visible = true; // <-- ДОБАВЛЕНО: чтобы графики не пропадали при ручном обновлении
        row.height = 20;    // <-- ДОБАВЛЕНО: чтобы графики не пропадали при ручном обновлении
        model.addRow(row);
    }
    
    (window as any).oscModel = model;
    
    const rowCount = model.rowCount > 0 ? model.rowCount : 1;
    view.updateRows(rowCount);
    
    buffers.length = 0;
    for (const row of model.rows) {
        buffers.push(row.signal.buffer);
    }
}