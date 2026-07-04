// js/file-loader.js

//Логика обработки и парсинга выбранного INI файла
//     * Срабатывает сразу после того, как пользователь выбрал файл на диске.
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';

export function setupFileHandling(fileInput) {
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const iniParser = new IniParser();
            const config = iniParser.parse(e.target.result);
            
            if (config['DEVICE']) {
                const isAdded = addDeviceToRegistry(config);
                if (isAdded) renderDeviceTree();
                populateDeviceForm(config['DEVICE']);
                renderModbusTable(config);
            }
        };
        reader.onerror = () => showIdModal("Ошибка чтения текстового файла");
        reader.readAsText(file, 'windows-1251');
        event.target.value = '';
    });
}