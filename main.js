// main.js - Сборка конвейера: Чтение, Парсинг Modbus и Расчет Высокоточных Интервалов (Задержек Windows)

try {
    if (typeof PIXI === 'undefined') throw new Error("PixiJS не найден.");
    if (typeof RingBuffer === 'undefined') throw new Error("RingBuffer не найден.");
    if (typeof PixiOscilloscope === 'undefined') throw new Error("PixiOscilloscope не найден.");
    if (typeof SerialConnection === 'undefined') throw new Error("SerialConnection не найден.");
    if (typeof ModbusParser === 'undefined') throw new Error("ModbusParser не найден.");

    // Инициализируем графический модуль осциллографа и пустой буфер
    const view = new PixiOscilloscope("osc-container");
    const testBuffer = new RingBuffer(1000);
    
    // Инициализируем физический драйвер порта и парсер Modbus
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    // Находим элементы текстового интерфейса
    const connectBtn = document.getElementById("connectBtn");
    const stPort = document.getElementById("st-port");
    const stModbus = document.getElementById("st-modbus");
    
    // Находим элементы панели высокоточных метрик времени
    const mLast = document.getElementById("m-last");
    const mAvg = document.getElementById("m-avg");
    const mMax = document.getElementById("m-max");
    const mSkips = document.getElementById("m-skips");
    const intervalsLog = document.getElementById("intervals-log");

    // Переменные для расчета задержек Windows
    let lastPacketTime = 0;
    let packetCount = 0;
    let totalIntervalsSum = 0;
    let maxInterval = 0;
    let lostPacketsCount = 0;
    const recentIntervals = []; // Хранилище для последних 20 интервалов

    // Привязываем клик по кнопке к открытию реального COM-порта
    connectBtn.addEventListener("click", async () => {
        try {
            stPort.textContent = "Выбор порта...";
            await serial.connect(115200);
            
            stPort.textContent = "ПОДКЛЮЧЕНО (115200)";
            stPort.style.color = "#00ff66";
            connectBtn.textContent = "ПОРТ ОТКРЫТ. ИДЕТ АНАЛИЗ ВРЕМЕНИ...";
            connectBtn.style.borderColor = "#00ff66";
            
            stModbus.textContent = "Поиск пакетов Modbus RTU...";
            stModbus.style.color = "#ffff00";

            // Сбрасываем метрики перед началом нового теста
            lastPacketTime = performance.now();
            packetCount = 0;
            totalIntervalsSum = 0;
            maxInterval = 0;
            lostPacketsCount = 0;
            recentIntervals.length = 0;

            // Запускаем фоновый цикл чтения
            readLoop();

        } catch (error) {
            console.error("Ошибка при открытии порта:", error.message);
            stPort.textContent = "Ошибка подключения";
            stPort.style.color = "#ff3333";
            alert(error.message);
        }
    });

    /**
     * Бесконечный фоновый цикл чтения и расчета задержек
     */
    async function readLoop() {
        console.log("[Main] Фоновый поток анализа задержек запущен.");
        
        try {
            while (serial.isConnected) {
                const chunk = await serial.readChunk();
                if (!chunk) break;

                parser.appendData(chunk);

                let adcValue = parser.parsePacket();
                while (adcValue !== null) {
                    
                    // --- ВЫСОКОТОЧНЫЙ РАСЧЕТ ИНТЕРВАЛОВ И ВРЕМЕНИ (БЛОК 3) ---
                    const currentTime = performance.now(); // Время с точностью до микросекунд
                    const interval = currentTime - lastPacketTime; // Сколько мс прошло с прошлого пакета
                    lastPacketTime = currentTime;

                    packetCount++;

                    // Пропускаем самый первый пакет, так как у него нет предыдущей точки отсчета
                    if (packetCount > 1) {
                        totalIntervalsSum += interval;
                        const avgInterval = totalIntervalsSum / (packetCount - 1);

                        // Фиксируем максимальный пиковый провал (джиттер) Windows
                        if (interval > maxInterval) {
                            maxInterval = interval;
                        }

                        // Если интервал между пакетами аномально большой (например, больше 35 мс вместо положенных 10 мс),
                        // это явный признак того, что Windows заморозила поток или пакеты потерялись
                        if (interval > 35) {
                            lostPacketsCount++;
                        }

                        // Добавляем интервал в массив последних 20 штук для вывода бегущей строки
                        recentIntervals.push(Math.round(interval));
                        if (recentIntervals.length > 20) {
                            recentIntervals.shift(); // Удаляем старые, держим ровно 20
                        }

                        // --- ОБНОВЛЕНИЕ ИНТЕРФЕЙСА В РЕАЛЬНОМ ВРЕМЕНИ ---
                        stModbus.textContent = `ПАКЕТЫ ИДУТ (ADC: ${adcValue})`;
                        stModbus.style.color = "#00ff66";

                        mLast.textContent = Math.round(interval);
                        mAvg.textContent = avgInterval.toFixed(1);
                        
                        // Если максимальная задержка превышает критические 40 мс — подсвечиваем красным
                        mMax.textContent = Math.round(maxInterval);
                        if (maxInterval > 40) {
                            mMax.className = "alert-value";
                        }

                        mSkips.textContent = lostPacketsCount;
                        if (lostPacketsCount > 0) {
                            mSkips.className = "alert-value";
                        }

                        // Выводим последние интервалы через пробел (бегущая строка чисел)
                        intervalsLog.textContent = recentIntervals.join(" ");
                    }

                    // Отдаем распарсенное значение АЦП в кольцевой буфер графики
                    testBuffer.push(adcValue);

                    // Забираем линейный массив точек и мгновенно прорисовываем на WebGL холсте
                    const linearData = testBuffer.getLinearData();
                    view.draw(linearData, testBuffer.capacity);

                    // Ищем следующий пакет в накопительном буфере
                    adcValue = parser.parsePacket();
                }
            }
        } catch (error) {
            console.error("[Main] Критическая ошибка в цикле чтения:", error.message);
            stModbus.textContent = "Ошибка парсинга / Срыв потока";
            stModbus.style.color = "#ff3333";
        }
    }

    // Рисуем пустую статичную сетку на экране при старте
    view.draw(new Float32Array(0), 1000);

} catch (error) {
    console.error("Ошибка инициализации главного файла:", error.message);
    alert("Ошибка: " + error.message);
}