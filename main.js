// main.js - Параллельный опрос и чтение с вынесенными конфигурационными параметрами Modbus

// === НАСТРОЙКИ ВАШЕЙ ПРОШИВКИ STM32 ===
// Если контроллер молчит, проверяйте эти параметры!
const SLAVE_ADDRESS = 0x01;  // Адрес STM32 в сети Modbus RTU
const REGISTER_ADDR = 0x002D; // Адрес запрашиваемого регистра (0x002D = 45 в десятичной)
// ======================================

try {
    if (typeof PIXI === 'undefined') throw new Error("PixiJS не найден.");
    if (typeof RingBuffer === 'undefined') throw new Error("RingBuffer не найден.");
    if (typeof PixiOscilloscope === 'undefined') throw new Error("PixiOscilloscope не найден.");
    if (typeof SerialConnection === 'undefined') throw new Error("SerialConnection не найден.");
    if (typeof ModbusParser === 'undefined') throw new Error("ModbusParser не найден.");

    const view = new PixiOscilloscope("osc-container");
    const testBuffer = new RingBuffer(1000);
    const testBuffer2 = new RingBuffer(1000); // Создали второй буфер для второго регистра
    
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const connectBtn = document.getElementById("connectBtn");
    const stPort = document.getElementById("st-port");
    const stModbus = document.getElementById("st-modbus");
    
    const mLast = document.getElementById("m-last");
    const mAvg = document.getElementById("m-avg");
    const mMax = document.getElementById("m-max");
    const mSkips = document.getElementById("m-skips");
    const intervalsLog = document.getElementById("intervals-log");

    let lastPacketTime = 0;
    let packetCount = 0;
    let totalIntervalsSum = 0;
    let maxInterval = 0;
    let lostPacketsCount = 0;
    const recentIntervals = []; 

    connectBtn.addEventListener("click", async () => {
        try {
            stPort.textContent = "Выбор порта...";
            await serial.connect(115200);
            
            stPort.textContent = "ПОДКЛЮЧЕНО (115200)";
            stPort.style.color = "#00ff66";
            connectBtn.textContent = "ПОРТ ОТКРЫТ. ИДЕТ АНАЛИЗ...";
            connectBtn.style.borderColor = "#00ff66";
            
            stModbus.textContent = "Поиск пакетов Modbus RTU...";
            stModbus.style.color = "#ffff00";

            lastPacketTime = performance.now();
            packetCount = 0;
            totalIntervalsSum = 0;
            maxInterval = 0;
            lostPacketsCount = 0;
            recentIntervals.length = 0;

            readLoop();   
            writeLoop();  

        } catch (error) {
            console.error("Ошибка при открытии порта:", error.message);
            stPort.textContent = "Ошибка подключения";
            stPort.style.color = "#ff3333";
            alert(error.message);
        }
    });

    /**
     * ПОТОК 1: Слушаем входящие байты
     */
    async function readLoop() {
        console.log("[Main] Поток НЕПРЕРЫВНОГО ЧТЕНИЯ успешно запущен.");
        try {
            while (serial.isConnected) {
                const chunk = await serial.readChunk();
                if (!chunk) break;

                // Выводим абсолютно все сырые байты в консоль разработчика (F12)
                console.log("[DEBUG RAW BYTES]:", Array.from(chunk).map(b => "0x" + b.toString(16).padStart(2, '0')).join(" "));

                parser.appendData(chunk);

                let packetData = parser.parsePacket();
                while (packetData !== null) {
                    // Передаем в обработчик полученные данные (массив или объект с двумя регистрами)
                    handleValidPacket(packetData);
                    packetData = parser.parsePacket();
                }
            }
        } catch (error) {
            console.error("[Main] Ошибка в непрерывном чтении:", error.message);
        }
    }

    /**
     * ПОТОК 2: Динамическая сборка пакета запроса с расчетом CRC16 на лету
     */
    async function writeLoop() {
        console.log("[Main] Поток ЦИКЛИЧЕСКОГО ОПРОСА (Мастер) успешно запущен.");
        console.log(`[Main] Конфигурация опроса: Slave=${SLAVE_ADDRESS}, Reg=0x${REGISTER_ADDR.toString(16).toUpperCase()}`);

        while (serial.isConnected) {
            try {
                // Собираем тело запроса функции 03 (6 байт)
                // ОБНОВЛЕНО: запрашиваем 0x00, 0x02 (2 регистра вместо 1)
                const body = new Uint8Array([
                    SLAVE_ADDRESS, 
                    0x03,                           // Функция чтения Holding Registers
                    (REGISTER_ADDR >> 8) & 0xFF,    // Адрес регистра High
                    REGISTER_ADDR & 0xFF,           // Адрес регистра Low
                    0x00, 0x02                      // Количество регистров (ТЕПЕРЬ 2 ШТУКИ)
                ]);

                // Считаем CRC16 Modbus
                let crc = 0xFFFF;
                for (let pos = 0; pos < body.length; pos++) {
                    crc ^= body[pos];
                    for (let i = 8; i !== 0; i--) {
                        if ((crc & 0x0001) !== 0) {
                            crc >>= 1;
                            crc ^= 0xA001;
                        } else {
                            crc >>= 1;
                        }
                    }
                }

                // Объединяем тело и 2 байта CRC в финальный пакет (8 байт)
                const finalPacket = new Uint8Array(8);
                finalPacket.set(body, 0);
                finalPacket[6] = crc & 0xFF;        // CRC Low
                finalPacket[7] = (crc >> 8) & 0xFF; // CRC High

                // Выталкиваем монолитный запрос в STM32
                await serial.write(finalPacket);

            } catch (error) {
                console.error("[Main] Ошибка отправки запроса:", error.message);
            }
            
            // Задержка 20 мс между запросами
            await new Promise(res => setTimeout(res, 40));
        }
    }

    // ОБНОВЛЕНО: Принимаем пакет packetData (который содержит два значения)
    function handleValidPacket(packetData) {
        const currentTime = performance.now(); 
        const interval = currentTime - lastPacketTime; 
        lastPacketTime = currentTime;

        packetCount++;

        // Извлекаем значения для двух графиков
        // Если парсер вернул массив: берем индекс 0 и 1. Если просто число — страхуемся, берем его
        let val1 = Array.isArray(packetData) ? packetData[0] : packetData;
        let val2 = Array.isArray(packetData) ? packetData[1] : packetData; // Если второго нет, временно продублирует первый

        if (packetCount > 1) {
            totalIntervalsSum += interval;
            const avgInterval = totalIntervalsSum / (packetCount - 1);

            if (interval > maxInterval) {
                maxInterval = interval;
            }

            recentIntervals.push(Math.round(interval));
            if (recentIntervals.length > 20) {
                recentIntervals.shift(); 
            }

            // Выводим в статус бары значения обоих регистров
            stModbus.textContent = `ПАКЕТЫ ИДУТ (R1: ${val1}, R2: ${val2})`;
            stModbus.style.color = "#00ff66";

            mLast.textContent = Math.round(interval);
            mAvg.textContent = avgInterval.toFixed(1);
            mMax.textContent = Math.round(maxInterval);
            
            if (maxInterval > 40) {
                mMax.className = "alert-value";
            }

            intervalsLog.textContent = recentIntervals.join(" ");
        }

        // Заполняем оба буфера данными соответствующих регистров
        testBuffer.push(val1);
        testBuffer2.push(val2);

        const linearData = testBuffer.getLinearData();
        const linearData2 = testBuffer2.getLinearData(); // Получаем данные из 2-го буфера
        
        // Передаем оба массива в draw
        view.draw(linearData, linearData2, testBuffer.capacity); 
    }

    // Добавили второй пустой массив для стартового кадра
    view.draw(new Float32Array(0), new Float32Array(0), 1000);

} catch (error) {
    console.error("Ошибка инициализации главного файла:", error.message);
    alert("Ошибка: " + error.message);
}