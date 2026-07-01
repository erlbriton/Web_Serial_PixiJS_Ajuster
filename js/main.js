const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0;
let isIdentifying = false; // Блокировщик для защиты от одновременного чтения

// База данных популярных USB-UART чипов (Vendor ID и Product ID)
const USB_CHIPS_DATABASE = {
    '10c4': {
        name: 'Silicon Labs',
        pids: {
            'ea60': 'CP2102/CP2103',
            'ea70': 'CP2105',
            'ea71': 'CP2108'
        }
    },
    '0403': {
        name: 'FTDI',
        pids: {
            '6001': 'FT232R',
            '6010': 'FT2232H',
            '6015': 'FT231X'
        }
    },
    '1a86': {
        name: 'Qinheng',
        pids: {
            '7523': 'CH340/CH341',
            '5523': 'CH341A'
        }
    },
    '067b': {
        name: 'Prolific',
        pids: {
            '2303': 'PL2303'
        }
    }
};

// Функция парсинга VID/PID и определения текстового названия чипа
function identifyUsbChip(info) {
    if (!info || !info.usbVendorId) {
        return "Встроенный COM-порт";
    }

    // Переводим числа VID/PID в HEX-строки нижнего регистра (например, 4292 -> "10c4")
    const vidStr = info.usbVendorId.toString(16).padStart(4, '0').toLowerCase();
    const pidStr = info.usbProductId ? info.usbProductId.toString(16).padStart(4, '0').toLowerCase() : null;

    const manufacturer = USB_CHIPS_DATABASE[vidStr];
    
    if (manufacturer) {
        if (pidStr && manufacturer.pids[pidStr]) {
            return manufacturer.pids[pidStr]; // Вернет например "CP2102/CP2103"
        }
        return `${manufacturer.name} USB`;
    }

    return `USB [${vidStr.toUpperCase()}:${pidStr ? pidStr.toUpperCase() : '????'}]`;
}

function showIdModal(text) {
    const existing = document.querySelector('.id-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'id-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'id-modal';
    
    modal.innerHTML = `
        <div class="id-modal-content">
            <span class="id-modal-text">${text}</span>
            <button class="id-modal-btn">OK</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('.id-modal-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

try {
    console.log("Зашел в try");
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const idBtn = document.getElementById("idBtn");
    const connectBtn = document.getElementById("connectBtn");
    const comSelect = document.getElementById("comSelect");

    // Обработчик основной кнопки "подключиться"
    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            console.log("Клик по кнопке подключения");
            
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }

            try {
                // Вызываем встроенный метод твоего класса для открытия сессии связи
                await serial.connect(115200);
                
                // Пытаемся безопасно прочитать getInfo() из нативного объекта порта внутри класса
                const portInfo = (serial.port && typeof serial.port.getInfo === 'function') 
                    ? serial.port.getInfo() 
                    : (typeof serial.getInfo === 'function' ? serial.getInfo() : {});
                
                const chipName = identifyUsbChip(portInfo);
                
                // Выводим имя чипа транслятора в таблицу настроек интерфейса
                if (comSelect) {
                    comSelect.innerHTML = `<option value="active">${chipName}</option>`;
                    comSelect.className = 'select-blue'; // Меняем цвет на активный синий
                }
                
                console.log(`Успешно подключено к чипу: ${chipName}`);

            } catch (error) {
                console.error("Ошибка при ручном подключении:", error.message);
                showIdModal("Ошибка подключения: " + error.message);
            }
        });
    }

    // Изолированный обработчик кнопки ID
    if (idBtn) {
        idBtn.addEventListener("click", async () => {
            console.log("idBtn = 1 (Клик получен)");
            
            if (serial.isConnected) {
                console.log("isConnected = 1");
                showIdModal("Порт уже открыт!");
                return;
            }

            try {
                isIdentifying = true; // Включаем защиту порта
                await serial.connect(115200);
                
                // Дублируем определение чипа здесь, если пользователь решил сразу нажать ID вместо "подключиться"
                const portInfo = (serial.port && typeof serial.port.getInfo === 'function') 
                    ? serial.port.getInfo() 
                    : (typeof serial.getInfo === 'function' ? serial.getInfo() : {});
                
                const chipName = identifyUsbChip(portInfo);
                if (comSelect) {
                    comSelect.innerHTML = `<option value="active">${chipName}</option>`;
                    comSelect.className = 'select-blue';
                }
                
                // Ждем 500мс, пока аджастер загрузится после открытия порта
                console.log("[ЖЕЛЕЗО] Порт открыт. Ждем стабилизации UART (500мс)...");
                await new Promise(r => setTimeout(r, 500));

                showIdModal("Запрос ID устройства...");
                
                // Команда Modbus 0x11 с правильным CRC [0xC0, 0x2C]
                const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
                await serial.write(packet);
                console.log("Команда ID с правильным CRC отправлена. Ожидаем ответ...");

                // Аккумулятор байтов ответа
                let reply = [];
                const startTime = Date.now();
                
                // Ищем ответ в течение 1.5 секунд
                while (Date.now() - startTime < 1500) {
                    const chunk = await serial.readChunk();
                    if (chunk && chunk.length > 0) {
                        console.log("Получен чанк из порта:", Array.from(chunk));
                        
                        for (let i = 0; i < chunk.length; i++) {
                            reply.push(chunk[i]);
                        }
                        
                        // Если получили заголовок, проверяем длину пакета
                        if (reply.length >= 3) {
                            const dataLength = reply[2]; 
                            const expectedTotalLength = 3 + dataLength + 2; 
                            
                            if (reply.length >= expectedTotalLength) {
                                console.log("Пакет ID полностью собран!");
                                break;
                            }
                        }
                    }
                    await new Promise(r => setTimeout(r, 20));
                }

                // Вывод сырых байтов в консоль
                console.log("Итоговые сырые байты ответа:", reply);

                if (reply.length >= 3) {
                    const dataLength = reply[2];
                    let idText = "";
                    
                    for (let i = 3; i < 3 + dataLength && i < reply.length; i++) {
                        // Фильтруем только печатные символы ASCII (от пробела и дальше)
                        if (reply[i] >= 32) {
                            idText += String.fromCharCode(reply[i]);
                        }
                    }
                    idText = idText.trim();
                    
                    // ВЫВОД В КОНСОЛЬ
                    console.log("=========================================");
                    console.log("УСПЕШНО СЧИТАН ID УСТРОЙСТВА:", idText);
                    console.log("=========================================");

                    // Запись текста в баннер таблицы
                    const idSpan = document.querySelector('.id-banner span');
                    if (idSpan) {
                        idSpan.textContent = idText;
                    }
                    
                    // Закрываем модальное окно уведомления
                    const modal = document.querySelector('.id-modal-overlay');
                    if (modal) modal.remove();
                } else {
                    console.warn("Устройство всё еще молчит. Получено байт:", reply.length);
                    showIdModal("Ошибка: Нет ответа от устройства (Timeout)");
                }

            } catch (error) {
                console.error("Ошибка внутри обработчика кнопки ID:", error.message);
                showIdModal("Ошибка: " + error.message);
            } finally {
                isIdentifying = false; // Снимаем защиту в любом случае
            }
        });
    }

    let isPolling = false;

    async function readLoop() {
        while (serial.isConnected && isPolling) {
            const chunk = await serial.readChunk();
            if (!chunk) break;
            parser.appendData(chunk);
            let packetData = parser.parsePacket();
            while (packetData !== null) {
                handleValidPacket(packetData);
                packetData = parser.parsePacket();
            }
        }
    }

    async function writeLoop() {
        while (serial.isConnected && isPolling) {
            const body = new Uint8Array([
                SLAVE_ADDRESS, 0x03, 
                (REGISTER_ADDR >> 8) & 0xFF, REGISTER_ADDR & 0xFF, 
                0x00, 0x46 
            ]);
            let crc = 0xFFFF;
            for (let pos = 0; pos < body.length; pos++) {
                crc ^= body[pos];
                for (let i = 8; i !== 0; i--) {
                    if ((crc & 0x0001) !== 0) { crc >>= 1; crc ^= 0xA001; } else { crc >>= 1; }
                }
            }
            const finalPacket = new Uint8Array(8);
            finalPacket.set(body, 0);
            finalPacket[6] = crc & 0xFF;        
            finalPacket[7] = (crc >> 8) & 0xFF; 

            await serial.write(finalPacket);
            await new Promise(res => setTimeout(res, 20));
        }
    }

    function handleValidPacket(packetData) {
        if (!Array.isArray(packetData)) return;
        const now = performance.now();
        if (lastPacketTime !== 0) {
            if (now - lastLogTime > 1000) {
                console.log("Последний интервал: " + Math.round(now - lastPacketTime) + " мс");
                lastLogTime = now;
            }
        }
        lastPacketTime = now;
        for (let i = 0; i < 70; i++) {
            buffers[i].push(packetData[i] || 0);
        }
        view.draw(buffers); 
    }

    const toggleOscBtn = document.getElementById('toggleOscBtn');
    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) {
                console.warn("Порт не open!");
                return;
            }
            if (isIdentifying) {
                console.warn("Подождите, идет чтение ID устройства...");
                return;
            }
            
            isPolling = !isPolling;
            if (isPolling) {
                readLoop(); 
                writeLoop();
            }
        });
    }

    // ==========================================================================
    // ЛОГИКА ДЛЯ СПЛИТ-КНОПКИ ВЫБОРА ФАЙЛА / ПАПКИ
    // ==========================================================================
    const folderActionBtn = document.getElementById('folderActionBtn');
    const folderArrowBtn = document.getElementById('folderArrowBtn');
    const folderDropdown = document.getElementById('folderDropdown');
    const menuOpenFile = document.getElementById('menuOpenFile');
    const menuOpenFolder = document.getElementById('menuOpenFolder');

    // 1. Создаем скрытый элемент для вызова системного окна
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ini,.txt'; // Жесткое ограничение расширений
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 2. Обработчик, который срабатывает, когда пользователь выбрал файл
    // 2. Обработчик, который срабатывает, когда пользователь выбрал файл
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return; // Если пользователь нажал "Отмена"

        console.log(`Выбран файл: ${file.name} (Размер: ${file.size} байт)`);

        // Читаем содержимое выбранного файла
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target.result;
            
            console.log("--- Чтение INI файла ---");
            
            // Создаем экземпляр парсера и скармливаем ему текст
            const iniParser = new IniParser();
            const config = iniParser.parse(fileContent);
            
            console.log("Распарсенные данные:", config);

            // Находим элементы текстовых полей на странице
            const mechanismInput = document.querySelector('.mechanism-input');
            const locationInput = document.querySelector('.location-input');

            // Проверяем, существует ли в распарсенных данных нужная секция [DEVICE]
            if (config['DEVICE']) {
                
                // Если есть поле Description, записываем его в "Тип механизма"
                if (config['DEVICE']['Description'] !== undefined && mechanismInput) {
                    mechanismInput.value = config['DEVICE']['Description'];
                    console.log(`В поле "Тип механизма" записано: ${config['DEVICE']['Description']}`);
                }

                // Если есть поле Location, записываем его в "Место установки"
                if (config['DEVICE']['Location'] !== undefined && locationInput) {
                    locationInput.value = config['DEVICE']['Location'];
                    console.log(`В поле "Место установки" записано: ${config['DEVICE']['Location']}`);
                }
            }

            // Наш старый отладочный пример для проверки конкретного параметра из ОЗУ
            const p00600 = iniParser.getParsedParameter('RAM', 'p00600');
            if (p00600) {
                console.log(`Параметр p00600: ${p00600.name} (${p00600.description}) - Тип: ${p00600.dataType}`);
            }
        };
        
        reader.onerror = () => {
            console.error("Произошла ошибка при чтении файла.");
            showIdModal("Ошибка чтения файла");
        };

        // ВАЖНО: Явно указываем кодировку Windows-1251 вместо UTF-8
        reader.readAsText(file, 'windows-1251'); 

        // Очищаем input, чтобы пользователь мог открыть этот же файл повторно
        event.target.value = ''; 
    });

    // 3. Привязываем клик по скрытому инпуту к нашей функции
    function actionOpenFile() {
        console.log("Вызвано действие: ОТКРЫТЬ ФАЙЛ");
        fileInput.click(); // Имитируем клик, открывая системный диалог
    }

    function actionOpenFolder() {
        console.log("Вызвано действие: ОТКРЫТЬ ПАПКУ");
        // Логика загрузки папки
    }

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

    // Закрытие меню при клике снаружи
    document.addEventListener('click', () => {
        if (folderDropdown && folderDropdown.classList.contains('show')) {
            folderDropdown.classList.remove('show');
        }
    });

} catch (error) {
    console.error("Ошибка инициализации:", error.message);
}