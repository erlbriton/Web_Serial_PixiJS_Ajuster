class PixiOscilloscope {
    constructor(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Контейнер с ID "${containerId}" не найден!`);
            return;
        }

        const rect = container.getBoundingClientRect();
        this.width = rect.width || container.clientWidth || 800;
        this.height = rect.height || container.clientHeight || 600;
        
        this.rowHeight = 20;
        this.totalRows = 70;
        this.scrollY = 0;

        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

        const forcedWidth = 800;
        const forcedHeight = 600;
        
        this.app = new PIXI.Application({
            width: forcedWidth,
            height: forcedHeight,
            backgroundColor: 0x000000,
            antialias: true
        });
        
        this.app.view.style.width = "100%";
        this.app.view.style.height = "100%";
        
        this.app.ticker.autoStart = false;
        this.app.ticker.stop();
        container.appendChild(this.app.view);

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const newWidth = entry.contentRect.width;
                const newHeight = entry.contentRect.height;
                if (newWidth > 0 && newHeight > 0) {
                    this.width = newWidth;
                    this.height = newHeight;
                    this.app.renderer.resize(this.width, this.height);
                }
            }
        });
        resizeObserver.observe(container);

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
            g.beginFill(0x1a1a1a);
            g.drawRect(0, yOffset, this.width, this.rowHeight);
            g.endFill();

            const buffer = buffers[i];
            if (buffer) {
                const data = buffer.getLinearData();
                if (data && data.length > 1) {
                    g.lineStyle(1, this.brightColors[i % 10], 1);
                    let started = false;
                    for (let j = 0; j < data.length; j++) {
                        const x = this.width - (j * 2);
                        if (x < 0) break;
                        const val = (data[data.length - 1 - j] / 1100) * this.rowHeight;
                        const y = yOffset + (this.rowHeight - val);
                        if (!started) {
                            g.moveTo(x, y);
                            started = true;
                        } else {
                            g.lineTo(x, y);
                        }
                    }
                }
            }
        }
        this.app.renderer.render(this.app.stage);
    }
}