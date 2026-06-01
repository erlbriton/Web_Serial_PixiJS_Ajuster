class PixiOscilloscope {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        this.width = container.clientWidth;
        // Высота холста приложения (четверть высоты экрана)
        this.height = window.innerHeight / 4; 

        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0x1a1a1a,
            antialias: true
        });
        container.appendChild(this.app.view);

        // Объект для первого (верхнего) графика и фона
        this.lineGraphics = new PIXI.Graphics();
        this.app.stage.addChild(this.lineGraphics);

        // Добавили объект для второго (нижнего) графика
        this.lineGraphics2 = new PIXI.Graphics();
        this.app.stage.addChild(this.lineGraphics2);
    }

    draw(dataArray1, dataArray2, maxCapacity) {
        // Очищаем предыдущие кадры для обеих линий
        this.lineGraphics.clear();
        if (this.lineGraphics2) this.lineGraphics2.clear();

        // 1. Возвращаем светлый фон на весь экран осциллографа
        this.lineGraphics.beginFill(0xf5f5f5); 
        this.lineGraphics.drawRect(0, 0, this.width, this.height);
        this.lineGraphics.endFill();

        // 2. Рисуем координатную сетку осциллографа
        this.lineGraphics.lineStyle(1, 0xe0e0e0, 1); 
        for (let x = 25; x < this.width; x += 25) {
            this.lineGraphics.moveTo(x, 0).lineTo(x, this.height);
        }
        for (let y = 25; y < this.height; y += 25) {
            this.lineGraphics.moveTo(0, y).lineTo(this.width, y);
        }

        // Высота зоны для одного графика — это ровно половина от общей высоты холста
        const zoneHeight = this.height / 2; 
        const stepX = this.width / maxCapacity;

        // --- ГРАФИК 1 (ВЕРХНИЙ) ---
        if (dataArray1 && dataArray1.length > 0) {
            // ПРАВИЛО: Масштаб строго фиксирован на уровне 1100
            const maxVal1 = 1100; 
            const scaleY1 = (zoneHeight / 2) / (maxVal1 * 1.05);
            const centerY1 = zoneHeight / 2; // Центр верхней половины холста

            this.lineGraphics.lineStyle(2, 0x0000ff, 1); // Синий цвет
            for (let i = 0; i < dataArray1.length; i++) {
                const x = i * stepX;
                const y = centerY1 - (dataArray1[i] * scaleY1);

                if (i === 0) {
                    this.lineGraphics.moveTo(x, y);
                } else {
                    this.lineGraphics.lineTo(x, y);
                }
            }
        }

        // --- ГРАФИК 2 (НИЖНИЙ) ---
        if (this.lineGraphics2 && dataArray2 && dataArray2.length > 0) {
            // ПРАВИЛО: Масштаб строго фиксирован на уровне 1100
            const maxVal2 = 1100; 
            const scaleY2 = (zoneHeight / 2) / (maxVal2 * 1.05);
            const centerY2 = zoneHeight + (zoneHeight / 2); // Центр нижней половины холста

            this.lineGraphics2.lineStyle(2, 0xff0000, 1); // Красный цвет
            for (let i = 0; i < dataArray2.length; i++) {
                const x = i * stepX;
                const y = centerY2 - (dataArray2[i] * scaleY2);

                if (i === 0) {
                    this.lineGraphics2.moveTo(x, y);
                } else {
                    this.lineGraphics2.lineTo(x, y);
                }
            }
        }
    }
}