// Импорт из того же уровня (папки js)
import { showIdModal, populateDeviceForm } from './ui.js';
import { renderModbusTable } from './tree.js';
import { addDeviceToRegistry, parseRegisterAddress, hexToFloat32, float32ToHex } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';
import { updateDeviceRegisters } from './serial/device_updater.js';

// Импорт из того же уровня
import { 
    updateComInterfaceName, 
    executeDeviceIdentification, 
    readLoop, 
    writeLoop 
} from './serial-actions.js';

/**
 * Единый объект разделяемого состояния приложения (Shared State).
 * Здесь хранятся флаги активности процессов и динамические параметры Modbus.
 * Любые изменения этих полей мгновенно учитываются в циклах опроса.
 */
const appState = {
    isIdentifying: false, // Флаг выполнения запроса ID устройства
    isPolling: false,     // Флаг активной работы осциллографа (чтение/запись)
    slaveAddress: 0x01,   // Динамический адрес устройства Modbus (изменяемый)
    registerAddr: 0x0000  // Динамический начальный регистр для чтения (изменяемый)
};

try {
    console.log("Приложение инициализировано. Запуск модульной структуры.");
    
    // Инициализация базовых классов для графики, буферов и связи
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    // Получение ссылок на элементы интерфейса страницы (DOM-элементы)
    const idBtn = document.getElementById("idBtn");
    const connectBtn = document.getElementById("connectBtn");
    const comSelect = document.getElementById("comSelect");
    const toggleOscBtn = document.getElementById('toggleOscBtn');
    const refreshBtn = document.getElementById("refresh-btn");
    
    // Элементы управления сплит-кнопкой выбора файлов/папок
    const folderActionBtn = document.getElementById('folderActionBtn');
    const folderArrowBtn = document.getElementById('folderArrowBtn');
    const folderDropdown = document.getElementById('folderDropdown');
    const menuOpenFile = document.getElementById('menuOpenFile');
    const menuOpenFolder = document.getElementById('menuOpenFolder');

    // Создание скрытого элемента ввода для удобного открытия INI-файлов через браузер
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ini,.txt'; 
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // =================================================================
    // ОБРАБОТЧИКИ СОБЫТИЙ ИНТЕРФЕЙСА
    // =================================================================

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
            if (serial && serial.isConnected) {
                console.log("Запуск обновления таблицы...");
                await updateDeviceRegisters(serial, appState.slaveAddress);
                console.log("Обновление завершено.");
            } else {
                showIdModal("Устройство не подключено!");
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
                console.log("Запуск циклов опроса осциллографа...");
                readLoop(serial, parser, view, buffers, appState); 
                writeLoop(serial, appState);
            } else {
                console.log("Опрос осциллографа остановлен пользователем.");
            }
        });
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return; 

        console.log(`Выбран файл конфигурации: ${file.name}`);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const iniParser = new IniParser();
            const config = iniParser.parse(e.target.result);
            console.log("Результат парсинга структуры INI:", config);

            if (config['DEVICE']) {
                const isAdded = addDeviceToRegistry(config);
                if (isAdded) renderDeviceTree(); 
                populateDeviceForm(config['DEVICE']); 
                renderModbusTable(config);
            }

            const p00600 = iniParser.getParsedParameter('RAM', 'p00600');
            if (p00600) {
                console.log(`Проверка параметра p00600: ${p00600.name} | Тип данных: ${p00600.dataType}`);
            }
        };
        
        reader.onerror = () => showIdModal("Ошибка чтения текстового файла");
        
        reader.readAsText(file, 'windows-1251'); 
        
        event.target.value = ''; 
    });

    const actionOpenFile = () => fileInput.click();
    const actionOpenFolder = () => console.log("Вызвано действие: ОТКРЫТЬ ПАПКУ (в разработке)");

    if (folderActionBtn) {
        folderActionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (folderDropdown) folderDropdown.classList.remove('show');
            actionOpenFile();
        });
    }
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