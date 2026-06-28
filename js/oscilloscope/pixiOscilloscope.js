class PixiOscilloscope {
   constructor(containerId) {
        const container = document.getElementById(containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.rowHeight = 20;
        this.totalRows = 70;
        this.scrollY = 0;

        // Палитра из 10 очень ярких «неоновых» цветов
        this.brightColors = [
            0x00FF00, // Ярко-зеленый
            0x00FFFF, // Циан
            0xFF00FF, // Маджента
            0xFFFF00, // Желтый
            0xFF4500, // Ярко-оранжевый
            0x0099FF, // Неоновый синий
            0xFF0088, // Ярко-розовый
            0xADFF2F, // Желто-зеленый
            0xFFFFFF, // Белый
            0x7B68EE  // Яркий фиолетовый
        ];

        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0x1a1a1a,
            antialias: true
        });
        container.appendChild(this.app.view);

        this.stageContainer = new PIXI.Container();
        this.app.stage.addChild(this.stageContainer);

        this.graphicsList = [];
        for (let i = 0; i < this.totalRows; i++) {
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }

        container.addEventListener('wheel', (e) => {
            this.scrollY -= e.deltaY;
            const minScroll = this.height - (this.totalRows * this.rowHeight);
            if (this.scrollY > 0) this.scrollY = 0;
            if (this.scrollY < minScroll) this.scrollY = minScroll;
            this.stageContainer.y = this.scrollY;
        });
    }

    draw(buffers) {
        const maxVal = 1100;
        const gridStep = 20; // шаг в пикселях
        
        // Скорость движения: 0.05 пикселя в миллисекунду
        const speed = 0.05; 
        const offset = (performance.now() * speed) % gridStep;
        
        // Определяем границы видимости относительно скролла
        const viewTop = -this.scrollY;
        const viewBottom = viewTop + this.height;

        for (let i = 0; i < this.totalRows; i++) {
            const g = this.graphicsList[i];
            const yOffset = i * this.rowHeight;

            if (yOffset + this.rowHeight < viewTop || yOffset > viewBottom) {
                g.visible = false;
                continue; 
            }
            
            g.visible = true;

            g.clear();
            // Устанавливаем единый темный цвет фона для всех строк
            g.beginFill(0x1a1a1a);
            g.drawRect(0, yOffset, this.width, this.rowHeight);
            g.endFill();

            // Рисуем вертикальные линии сетки
            g.lineStyle(1, 0x333333, 1); 
            for (let x = -offset; x <= this.width; x += gridStep) {
                g.moveTo(x, yOffset);
                g.lineTo(x, yOffset + this.rowHeight);
            }

            const buffer = buffers[i];
            if (buffer) {
                const data = buffer.getLinearData(); 
                if (data && data.length > 0) {
                    const stepX = this.width / buffer.capacity;
                    g.lineStyle(1, this.brightColors[i % 10], 1);

                    for (let j = 0; j < data.length; j++) {
                        const reversedIndex = data.length - 1 - j;
                        const x = this.width - (j * stepX);
                        const val = (data[reversedIndex] / maxVal) * this.rowHeight;
                        const y = yOffset + (this.rowHeight - val);
                        
                        if (j === 0) g.moveTo(x, y);
                        else g.lineTo(x, y);
                    }
                }
            }
        }
    }
}