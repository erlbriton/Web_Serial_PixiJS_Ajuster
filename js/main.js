const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0;
let isIdentifying = false; // Блокировщик для защиты от одновременного чтения

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

    function actionOpenFile() {
        console.log("Вызвано действие: ОТКРЫТЬ ФАЙЛ");
        // Логика загрузки файла
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