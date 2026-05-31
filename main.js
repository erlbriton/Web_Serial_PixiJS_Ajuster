// main.js - Подготовка кнопки и привязка к Web Serial API

try {
    if (typeof PIXI === 'undefined') throw new Error("PixiJS не найден.");
    if (typeof RingBuffer === 'undefined') throw new Error("RingBuffer не найден.");
    if (typeof PixiOscilloscope === 'undefined') throw new Error("PixiOscilloscope не найден.");
    if (typeof SerialConnection === 'undefined') throw new Error("SerialConnection не найден.");
    if (typeof ModbusParser === 'undefined') throw new Error("ModbusParser не найден.");
    // Инициализируем графический модуль осциллографа и пустой буфер
    const view = new PixiOscilloscope("osc-container");
    const testBuffer = new RingBuffer(1000);
    
    // Инициализируем физический драйвер порта
    const serial = new SerialConnection();

    // Находим элементы текстового интерфейса
    const connectBtn = document.getElementById("connectBtn");
    const stPort = document.getElementById("st-port");

    // Привязываем клик по кнопке к открытию реального COM-порта
    connectBtn.addEventListener("click", async () => {
        try {
            stPort.textContent = "Выбор порта...";
            
            // Запускаем нативный диалог Windows на стандартной скорости STM32
            await serial.connect(115200);
            
            // Если дошли до этой строчки — пользователь выбрал порт
            stPort.textContent = "ПОДКЛЮЧЕНО (115200)";
            stPort.style.color = "#00ff66";
            connectBtn.textContent = "ПОРТ ОТКРЫТ";
            connectBtn.style.borderColor = "#fff";
            connectBtn.style.color = "#fff";
            
            console.log("Проверка шага успешна: Драйвер открыл порт!");
        } catch (error) {
            console.error("Ошибка при открытии порта:", error.message);
            stPort.textContent = "Ошибка подключения";
            stPort.style.color = "#ff3333";
            alert(error.message);
        }
    });

    // Рисуем пустую статичную сетку на экране, синусоиду убираем
    view.draw(new Float32Array(0), 1000);

} catch (error) {
    console.error("Ошибка инициализации главного файла:", error.message);
    alert("Ошибка: " + error.message);
}