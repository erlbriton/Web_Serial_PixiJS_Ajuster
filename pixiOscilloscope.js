// pixiOscilloscope.js
class PixiOscilloscope {
    /**
     * @param {string} containerId - ID HTML-элемента, куда внедрится WebGL-экран
     * @param {number} width - Ширина экрана в пикселях
     * @param {number} height - Высота экрана в пикселях
     */
    constructor(containerId, width = 700, height = 350) {
        // Создаем высокопроизводительное приложение PixiJS (WebGL)
        this.app = new PIXI.Application({
            width: width,
            height: height,
            backgroundColor: 0x020203, // Глубокий темный фон
            antialias: true
        });
        
        // Встраиваем созданный WebGL-холст в интерфейс
        document.getElementById(containerId).appendChild(this.app.view);
        
        // Создаем графический объект Pixi для динамического рисования векторов
        this.lineGraphics = new PIXI.Graphics();
        this.app.stage.addChild(this.lineGraphics);
        
        this.width = width;
        this.height = height;
    }

    /**
     * Отрисовка сетки и луча.
     * @param {Float32Array} dataArray - Хронологический срез данных из кольцевого буфера
     * @param {number} maxCapacity - Максимальная емкость буфера (1000 точек)
     */
    draw(dataArray, maxCapacity) {
        // Очищаем предыдущий кадр в видеопамяти
        this.lineGraphics.clear();

        // 1. Рисуем координатную сетку осциллографа (шаг 50 пикселей)
        this.lineGraphics.lineStyle(1, 0x141416, 1); // Тонкие темно-серые линии
        for (let x = 50; x < this.width; x += 50) {
            this.lineGraphics.moveTo(x, 0).lineTo(x, this.height);
        }
        for (let y = 50; y < this.height; y += 50) {
            this.lineGraphics.moveTo(0, y).lineTo(this.width, y);
        }

        if (!dataArray || dataArray.length === 0) return;

        // 2. Рассчитываем масштаб сигнала по вертикали
        let maxVal = 100;
        for (let i = 0; i < dataArray.length; i++) {
            let absVal = Math.abs(dataArray[i]);
            if (absVal > maxVal) maxVal = absVal;
        }
        const scaleY = (this.height / 2) / (maxVal * 1.2);
        const centerY = this.height / 2;
        const stepX = this.width / maxCapacity; // Шаг по горизонтали зависит от размера буфера

        // 3. Отрисовываем луч ярко-зеленым цветом
        this.lineGraphics.lineStyle(2, 0x00ff66, 1);
        
        for (let i = 0; i < dataArray.length; i++) {
            const x = i * stepX;
            const y = centerY - (dataArray[i] * scaleY);

            if (i === 0) {
                this.lineGraphics.moveTo(x, y);
            } else {
                this.lineGraphics.lineTo(x, y);
            }
        }
    }
}