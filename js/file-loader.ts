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
    parser: IniParser;
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
                    const config = appState.parser.parse(content);

                    if (config['DEVICE']) {
                        appState.currentDeviceConfig = config;

                        // ==========================================
                        // НОВАЯ АРХИТЕКТУРА: Создание MonitorModel
                        // ==========================================
                        const model = new MonitorModel();
                        const ramParams = appState.parser.getSectionParameters('RAM');
                        
                        for (const param of ramParams) {
                            const regAddressNum = parseInt(param.regAddress, 10);
                            const multiplierNum = parseFloat(param.multiplier.replace(',', '.'));
                            
                            // Создаем сигнал как объект, соответствующий интерфейсу MonitorSignal
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
                            
                            const row = new MonitorRow(signal);
                            model.addRow(row);
                        }
                        
                        // Сохраняем модель как единственный источник истины
                        (window as any).oscModel = model;
                        
                        console.log(`✅ DEBUG: MonitorModel создана. Строк: ${model.rowCount}`);

                        // Обновляем старый интерфейс (временный мостик)
                        const rowCount = model.rowCount > 0 ? model.rowCount : 1;
                        view.updateRows(rowCount);
                        
                        // Заполняем старый массив буферов из новой модели
                        buffers.length = 0;
                        for (const row of model.rows) {
                            buffers.push(row.signal.buffer);
                        }
                        // ==========================================

                        const isAdded = addDeviceToRegistry(config);
                        if (isAdded) renderDeviceTree(appState, view, buffers);

                        populateDeviceForm(config['DEVICE']);
                        renderModbusTable(config);
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
    // Применяем ту же логику для ручного обновления
    const model = new MonitorModel();
    const ramParams = parser.getSectionParameters('RAM');
    
    for (const param of ramParams) {
        const regAddressNum = parseInt(param.regAddress, 10);
        const multiplierNum = parseFloat(param.multiplier.replace(',', '.'));
        
        for (const param of ramParams) {
                            const regAddressNum = parseInt(param.regAddress, 10);
                            const multiplierNum = parseFloat(param.multiplier.replace(',', '.'));
                            
                            // Создаем сигнал как объект, соответствующий интерфейсу MonitorSignal
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
                            
                            const row = new MonitorRow(signal);
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
}