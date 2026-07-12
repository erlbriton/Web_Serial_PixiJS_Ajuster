// js/file-loader.ts
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';
// Если у вас нет типов для IniParser, он будет any, это нормально
import { IniParser } from './iniParser.js';

// Интерфейс для appState, чтобы TS знал, что внутри
interface AppState {
    parser: any; 
    currentDeviceConfig: any;
}

export function setupFileHandling(fileInput: HTMLInputElement, appState: AppState) {
    fileInput.addEventListener('change', (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (!target.files) return;
        
        const files = Array.from(target.files);
        if (files.length === 0) return;

        files.forEach((file: File) => {
            const reader = new FileReader();

            reader.onload = (e: ProgressEvent<FileReader>) => {
                try {
                    // Явно говорим, что e.target.result - это строка
                    const content = e.target?.result as string;
                    const config = appState.parser.parse(content);

                    if (config['DEVICE']) {
                        appState.currentDeviceConfig = config;

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