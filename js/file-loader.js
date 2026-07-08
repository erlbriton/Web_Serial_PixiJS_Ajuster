// js/file-loader.js
import { showIdModal, populateDeviceForm } from './ui.js';
import { addDeviceToRegistry } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { renderModbusTable } from './tree.js';

export function setupFileHandling(fileInput) {
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        files.forEach((file) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const iniParser = new IniParser();
                    const config = iniParser.parse(e.target.result);

                    if (config['DEVICE']) {
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

        fileInput.value = ''; // Сброс инпута для повторного выбора
    });
}