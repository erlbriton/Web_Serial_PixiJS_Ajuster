// js/file-loader.js
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';
import { IniParser } from './iniParser.js';

export function setupFileHandling(fileInput, appState) { // Добавили appState
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        files.forEach((file) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    // Используем парсер из appState, а не создаем новый
                    const config = appState.parser.parse(e.target.result);

                    if (config['DEVICE']) {
                        // СОХРАНЯЕМ КОНФИГУРАЦИЮ: теперь readLoop увидит секцию 'RAM'
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