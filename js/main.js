import { showIdModal, populateDeviceForm } from './ui.js';
import { renderModbusTable } from './tree.js';
import { addDeviceToRegistry, parseRegisterAddress, hexToFloat32, float32ToHex } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { updateDeviceRegisters } from './serial/device_updater.js';
import { setupFileHandling } from './file-loader.js';

import { 
    updateComInterfaceName, 
    executeDeviceIdentification, 
    readLoop 
} from './serial-actions.js';

const appState = {
    isIdentifying: false,
    isPolling: false,
    isRefreshing: false, 
    slaveAddress: 0x01,
    registerAddr: 0x0000 
};

try {
    console.log("Приложение инициализировано. Запуск модульной структуры.");
    
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const idBtn = document.getElementById("idBtn");
    const connectBtn = document.getElementById("connectBtn");
    const comSelect = document.getElementById("comSelect");
    const toggleOscBtn = document.getElementById('toggleOscBtn');
    const refreshBtn = document.getElementById("refresh-btn");
    
    const folderActionBtn = document.getElementById('folderActionBtn');
    const folderArrowBtn = document.getElementById('folderArrowBtn');
    const folderDropdown = document.getElementById('folderDropdown');
    const menuOpenFile = document.getElementById('menuOpenFile');
    const menuOpenFolder = document.getElementById('menuOpenFolder');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ini,.txt'; 
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }
            try {
                await serial.connect(115200);
                const chipName = updateComInterfaceName(serial, comSelect);
                console.log(`Успешно подключено к устройству: ${chipName}`);
            } catch (error) {
                console.error("Ошибка при ручном подключении:", error.message);
                showIdModal("Ошибка подключения: " + error.message);
            }
        });
    }

    if (idBtn) {
        idBtn.addEventListener("click", async () => {
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }
            await executeDeviceIdentification(serial, comSelect, appState);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            if (!serial || !serial.isConnected) {
                showIdModal("Устройство не подключено!");
                return;
            }

            if (appState.isRefreshing) return; 
            appState.isRefreshing = true;
            refreshBtn.disabled = true;
            
            console.log("Запуск обновления таблицы...");

            try {
                const wasPolling = await updateDeviceRegisters(serial, appState.slaveAddress, appState);
                console.log("Обновление завершено.");
                
                // Сначала снимаем блокировку
                appState.isRefreshing = false;
                
                // Только потом проверяем и запускаем цикл опроса осциллографа
                if (wasPolling) {
                    appState.isPolling = true;
                    console.log("Возобновление цикла опроса...");
                    readLoop(serial, parser, view, buffers, appState); 
                }
            } catch (err) {
                appState.isRefreshing = false; // Обязательно снимаем флаг при ошибке
                console.error("Ошибка в процессе обновления:", err);
            } finally {
                refreshBtn.disabled = false;
            }
        });
    }

    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) {
                console.warn("Действие невозможно: порт закрыт!");
                return;
            }
            if (appState.isIdentifying) {
                console.warn("Подождите, выполняется чтение ID устройства...");
                return;
            }
            appState.isPolling = !appState.isPolling;
            if (appState.isPolling) {
                console.log("Запуск цикла опроса осциллографа...");
                readLoop(serial, parser, view, buffers, appState); 
            } else {
                console.log("Опрос осциллографа остановлен пользователем.");
            }
        });
    }

    // 1. Инициализируем глобальное состояние
window.appState = {
    parser: null,
    config: null,
    isPolling: false
};

// 1. Инициализируем глобальное состояние
window.appState = {
    parser: null,
    config: null,
    isPolling: false
};

// 2. Ждем готовности DOM
document.addEventListener('DOMContentLoaded', () => {
    // Находим наши скрытые инпуты
    const filePicker = document.getElementById('filePicker');
    const folderPicker = document.getElementById('folderPicker');

    // Инициализируем обработчики (убедитесь, что функции импортированы в начале файла)
    if (filePicker) setupFileHandling(filePicker);
    
    // Если setupFolderHandling еще не написана, создайте ее или оставьте эту проверку
    if (folderPicker && typeof setupFolderHandling === 'function') {
        setupFolderHandling(folderPicker);
    }

    // --- ПРИВЯЗКА КНОПОК ---

    // 1. Основная кнопка (📁) -> Открывает файл
   // const folderActionBtn = document.getElementById('folderActionBtn');
    if (folderActionBtn) {
        folderActionBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Важно: останавливает всплытие события
            filePicker.click();
        });
    }

    // 2. Пункт меню "Открыть файл" -> Открывает файл
    const menuOpenFile = document.getElementById('menuOpenFile');
    if (menuOpenFile) {
        menuOpenFile.addEventListener('click', (e) => {
            e.stopPropagation();
            filePicker.click();
        });
    }

    // 3. Пункт меню "Открыть папку" -> Открывает папку
    const menuOpenFolder = document.getElementById('menuOpenFolder');
    if (menuOpenFolder) {
        menuOpenFolder.addEventListener('click', (e) => {
            e.stopPropagation();
            folderPicker.click();
        });
    }

    console.log("Updater: Файловые обработчики и кнопки инициализированы.");
});

// 2. Ждем готовности DOM
// document.addEventListener('DOMContentLoaded', () => {
//     // Получаем ссылки на скрытые инпуты
//     const filePicker = document.getElementById('filePicker');
//     const folderPicker = document.getElementById('folderPicker');

//     // Инициализируем обработчики (убедитесь, что функции импортированы)
//     if (filePicker) setupFileHandling(filePicker);
    
//     // Если у вас еще нет setupFolderHandling, создайте функцию-заглушку в file-utils.js
//     // export function setupFolderHandling(input) { ... }
//     if (folderPicker && typeof setupFolderHandling !== 'undefined') {
//         setupFolderHandling(folderPicker);
//     }

//     // Привязываем кнопки интерфейса к скрытым инпутам
    
//     // 1. Основная кнопка (📁) -> Открывает файл
//     document.getElementById('folderActionBtn').addEventListener('click', () => {
//         filePicker.click();
//     });

//     // 2. Пункт меню "Открыть файл" -> Открывает файл
//     document.getElementById('menuOpenFile').addEventListener('click', () => {
//         filePicker.click();
//     });

//     // 3. Пункт меню "Открыть папку" -> Открывает папку
//     document.getElementById('menuOpenFolder').addEventListener('click', () => {
//         folderPicker.click();
//     });

//     console.log("Updater: Файловые обработчики и кнопки инициализированы.");
// });

    // fileInput.addEventListener('change', (event) => {
    //     const file = event.target.files[0];
    //     if (!file) return; 

    //     console.log(`Выбран файл конфигурации: ${file.name}`);
    //     const reader = new FileReader();

    //     //////////////////////////////////////////////////////////////////////////\
        
    //     reader.onload = (e) => {
    //         const iniParser = new IniParser();
    //         const config = iniParser.parse(e.target.result);
    //         if (config['DEVICE']) {
    //             const isAdded = addDeviceToRegistry(config);
    //             if (isAdded) renderDeviceTree(); 
    //             populateDeviceForm(config['DEVICE']); 
    //             renderModbusTable(config);
    //         }
    //     };
    //     /////////////////////////////////////////////////////////////////////////////
    //     reader.onerror = () => showIdModal("Ошибка чтения текстового файла");
    //     reader.readAsText(file, 'windows-1251'); 
    //     event.target.value = ''; 
    // });

    const actionOpenFile = () => fileInput.click();
    const actionOpenFolder = () => console.log("Вызвано действие: ОТКРЫТЬ ПАПКУ (в разработке)");

    // if (folderActionBtn) {
    //     folderActionBtn.addEventListener('click', (e) => {
    //         e.stopPropagation();
    //         if (folderDropdown) folderDropdown.classList.remove('show');
    //         actionOpenFile();
    //     });
    // }
    if (folderArrowBtn) {
        folderArrowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (folderDropdown) folderDropdown.classList.toggle('show');
        });
    }
    if (menuOpenFile) {
        menuOpenFile.addEventListener('click', () => {
            actionOpenFile();
            if (folderDropdown) folderDropdown.classList.remove('show');
        });
    }
    if (menuOpenFolder) {
        menuOpenFolder.addEventListener('click', () => {
            actionOpenFolder();
            if (folderDropdown) folderDropdown.classList.remove('show');
        });
    }
    
    document.addEventListener('click', () => {
        if (folderDropdown) folderDropdown.classList.remove('show');
    });

} catch (error) {
    console.error("Критическая ошибка при инициализации модулей:", error.message);
}