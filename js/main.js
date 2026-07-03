// Импорт из того же уровня (папки js)
import { showIdModal, populateDeviceForm } from './ui.js';
import { renderModbusTable } from './tree.js';
import { addDeviceToRegistry, parseRegisterAddress, hexToFloat32, float32ToHex } from './ini-manager/tree-core.js';
import { renderDeviceTree } from './ini-manager/tree-ui.js';

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
    // (Предполагается, что эти классы объявлены глобально или подключены в index.html)
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    // Получение ссылок на элементы интерфейса страницы (DOM-элементы)
    const idBtn = document.getElementById("idBtn");
    const connectBtn = document.getElementById("connectBtn");
    const comSelect = document.getElementById("comSelect");
    const toggleOscBtn = document.getElementById('toggleOscBtn');
    
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

    /**
     * 1. Обработчик кнопки "Подключиться"
     * Служит для ручного открытия выбранного COM-порта.
     */
    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }
            try {
                // Подключаемся к порту на стандартной скорости 115200 бод
                await serial.connect(115200);
                // Запрашиваем информацию о железе (VID/PID) и выводим тип USB-чипа
                const chipName = updateComInterfaceName(serial, comSelect);
                console.log(`Успешно подключено к устройству: ${chipName}`);
            } catch (error) {
                console.error("Ошибка при ручном подключении:", error.message);
                showIdModal("Ошибка подключения: " + error.message);
            }
        });
    }

    /**
     * 2. Обработчик кнопки "Опрос ID"
     * Автоматически открывает порт и отправляет команду идентификации 0x11.
     */
    if (idBtn) {
        idBtn.addEventListener("click", async () => {
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }
            // Вызов внешней бизнес-логики из модуля serial-actions.js
            await executeDeviceIdentification(serial, comSelect, appState);
        });
    }

    /**
     * 3. Обработчик кнопки запуска/остановки осциллографа
     * Управляет флагом опроса и запускает параллельные асинхронные циклы.
     */
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
            
            // Инвертируем текущее состояние опроса
            appState.isPolling = !appState.isPolling;
            
            if (appState.isPolling) {
                console.log("Запуск циклов опроса осциллографа...");
                // Запуск асинхронного выгребания данных из UART
                readLoop(serial, parser, view, buffers, appState); 
                // Запуск асинхронной отправки запросов 0x03 в устройство
                writeLoop(serial, appState);
            } else {
                console.log("Опрос осциллографа остановлен пользователем.");
            }
        });
    }

    /**
     * 4. Логика обработки и парсинга выбранного INI файла
     * Срабатывает сразу после того, как пользователь выбрал файл на диске.
     */
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return; 

        console.log(`Выбран файл конфигурации: ${file.name}`);
        const reader = new FileReader();
        
        // Событие успешного завершения чтения файла в память браузepа
        reader.onload = (e) => {
            const iniParser = new IniParser();
            const config = iniParser.parse(e.target.result);
            console.log("Результат парсинга структуры INI:", config);

            // Если в файле есть валидная секция устройства, обновляем дерево и форму
            if (config['DEVICE']) {
                const isAdded = addDeviceToRegistry(config);
                if (isAdded) renderDeviceTree(); // Перерисовываем боковую панель при успехе
                populateDeviceForm(config['DEVICE']); // Заполняем текстовые поля ввода
                
                // ШАГ 2: Передаем распарсенный конфиг напрямую в отрисовку таблицы параметров
                renderModbusTable(config);
            }

            // Пример безопасного извлечения параметров для отладки
            const p00600 = iniParser.getParsedParameter('RAM', 'p00600');
            if (p00600) {
                console.log(`Проверка параметра p00600: ${p00600.name} | Тип данных: ${p00600.dataType}`);
            }
        };
        
        reader.onerror = () => showIdModal("Ошибка чтения текстового файла");
        
        // Читаем строго в кодировке Windows-1251 для корректной поддержки кириллицы
        reader.readAsText(file, 'windows-1251'); 
        
        // Сбрасываем значение, чтобы браузер позволял открывать один и тот же файл повторно
        event.target.value = ''; 
    });

    /**
     * 5. Управление поведением Сплит-Кнопки (Интерфейс выбора Файл / Папка)
     */
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
    
    // Закрываем выпадающий список папки, если пользователь кликнул мимо меню
    document.addEventListener('click', () => {
        if (folderDropdown) folderDropdown.classList.remove('show');
    });

} catch (error) {
    console.error("Критическая ошибка при инициализации модулей:", error.message);
}