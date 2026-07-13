// js/file-loader.ts
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';
// Если у вас нет типов для IniParser, он будет any, это нормально
import { IniParser } from './iniParser.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';

// Интерфейс для appState, чтобы TS знал, что внутри
interface AppState {
    parser: any; 
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

                        // ОБНОВЛЕНИЕ ОСЦИЛЛОГРАФА
                        const ramParams = appState.parser.getSectionParameterKeys('RAM');
                        const rowCount = ramParams.length > 0 ? ramParams.length : 1;
                        
                        view.updateRows(rowCount);
                        
                        // Заменяем содержимое массива buffers на новые
                        const newBuffers = Array.from({ length: rowCount }, () => new RingBuffer(2500));
                        buffers.splice(0, buffers.length, ...newBuffers);

                        const isAdded = addDeviceToRegistry(config);
                        if (isAdded) renderDeviceTree();
                        
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