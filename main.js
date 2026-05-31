// main.js - Динамический тест PixiOscilloscope и RingBuffer

try {
    if (typeof PIXI === 'undefined') throw new Error("PixiJS не найден.");
    if (typeof RingBuffer === 'undefined') throw new Error("RingBuffer не найден.");
    if (typeof PixiOscilloscope === 'undefined') throw new Error("PixiOscilloscope не найден.");

    // Инициализируем наш графический модуль осциллографа
    const view = new PixiOscilloscope("osc-container");

    // Создаем буфер на 1000 точек
    const testBuffer = new RingBuffer(1000);
    
    let tick = 0;

    // Запускаем непрерывный цикл отрисовки, привязанный к частоте монитора
    function animate() {
        requestAnimationFrame(animate);

        // Имитируем непрерывное поступление данных: каждую итерацию кадра добавляем новую точку
        tick++;
        const fakeStmValue = Math.sin(tick * 0.05) * 200;
        testBuffer.push(fakeStmValue);

        // Забираем из буфера линейный массив и отдаем PixiJS на прорисовку
        const linearData = testBuffer.getLinearData();
        view.draw(linearData, testBuffer.capacity);
    }

    // Стартуем цикл анимации
    animate();

    console.log("Динамический тест графики запущен!");

} catch (error) {
    console.error("Ошибка теста графики:", error.message);
    alert("Ошибка: " + error.message);
}