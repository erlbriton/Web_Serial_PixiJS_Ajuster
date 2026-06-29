const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0; // Для контроля частоты вывода в консоль

try {
    const view = new PixiOscilloscope("osc-container");
    
    // Создаем массив из 70 независимых буферов
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const idBtn = document.getElementById("idBtn");

    // Кнопка просто открывает порт, но циклы опроса не запускает!
    idBtn.addEventListener("click", async () => {
        try {
            await serial.connect(115200);
            console.log("Порт успешно открыт. Опрос ожидает открытия осциллографа.");
        } catch (error) {
             console.error("Ошибка подключения:", error.message);
        }
    });

    // Переменная-флаг для контроля работы циклов
    let isPolling = false;

    async function readLoop() {
        // Цикл работает только пока порт соединен И поднят флаг опроса
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
        console.log("Цикл чтения остановлен.");
    }

    async function writeLoop() {
        // Цикл работает только пока порт соединен И поднят флаг опроса
        while (serial.isConnected && isPolling) {
            const body = new Uint8Array([
                SLAVE_ADDRESS, 
                0x03,                           
                (REGISTER_ADDR >> 8) & 0xFF,    
                REGISTER_ADDR & 0xFF,           
                0x00, 0x46 // Запрашиваем ровно 70 регистров (0x46 = 70)
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
            await new Promise(res => setTimeout(res, 20)); // Пауза опроса
        }
        console.log("Цикл опроса/записи остановлен.");
    }

    function handleValidPacket(packetData) {
        if (!Array.isArray(packetData)) return;

        // Считаем интервал
        const now = performance.now();
        if (lastPacketTime !== 0) {
            const interval = Math.round(now - lastPacketTime);
            
            // Выводим в консоль только если прошла 1 секунда (1000 мс)
            if (now - lastLogTime > 1000) {
                console.log("Последний интервал: " + interval + " мс");
                lastLogTime = now;
            }
        }
        lastPacketTime = now;

        // Распределяем данные
        for (let i = 0; i < 70; i++) {
            buffers[i].push(packetData[i] || 0);
        }

        // Отрисовка
        view.draw(buffers); 
    }

    // ВТОРОЙ обработчик на ту же кнопку (Логика управления потоком данных)
    const toggleOscBtn = document.getElementById('toggleOscBtn');

    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            // 1. Исправлено: Проверяем реальный статус коннекта через ваш объект serial
            if (!serial.isConnected) {
                console.warn("Невозможно запустить опрос: COM-порт не подключен!");
                return;
            }

            // 2. Переключаем флаг активности опроса (true <-> false)
            isPolling = !isPolling;

            // 3. Запускаем или плавно останавливаем циклы
            if (isPolling) {
                console.log("📈 Запускаем опрос регистров для осциллографа...");
                readLoop();   
                writeLoop();  
            } else {
                console.log("📉 Останавливаем опрос регистров.");
                // Специально ничего не вызываем: циклы увидят, что isPolling === false, и сами завершатся
            }
        });
    }

} catch (error) {
    console.error("Ошибка инициализации:", error.message);
}