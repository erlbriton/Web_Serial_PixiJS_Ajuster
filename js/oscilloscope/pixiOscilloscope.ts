// js/oscilloscope/pixiOscilloscope.ts

interface RingBuffer {
    getLinearData: () => number[];
}

export class PixiOscilloscope {
    private width: number;
    private height: number;
    private rowHeight: number = 20;
    private totalRows: number = 70;
    private scrollY: number = 0;
    private brightColors: number[];
    private app: any;
    private stageContainer: any;
    private graphicsList: any[];

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Контейнер с ID "${containerId}" не найден!`);
        }

        const rect = container.getBoundingClientRect();
        this.width = rect.width || container.clientWidth || 800;
        this.height = rect.height || container.clientHeight || 600;
        
        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

        // @ts-ignore
        this.app = new PIXI.Application({
            width: 800,
            height: 600,
            backgroundColor: 0x000000,
            antialias: true
        });
        
        (this.app.view as HTMLCanvasElement).style.width = "100%";
        (this.app.view as HTMLCanvasElement).style.height = "100%";
        
        this.app.ticker.autoStart = false;
        this.app.ticker.stop();
        container.appendChild(this.app.view as HTMLCanvasElement);

        const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
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

        // @ts-ignore
        this.stageContainer = new PIXI.Container();
        this.app.stage.addChild(this.stageContainer);

        this.graphicsList = [];
        for (let i = 0; i < this.totalRows; i++) {
            // @ts-ignore
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }

        container.addEventListener('wheel', (e: WheelEvent) => {
            this.scrollY -= e.deltaY;
            const minScroll = this.height - (this.totalRows * this.rowHeight);
            if (this.scrollY > 0) this.scrollY = 0;
            if (this.scrollY < minScroll) this.scrollY = minScroll;
            this.stageContainer.y = this.scrollY;
        });
    }

    draw(buffers: (RingBuffer | null)[]): void {
        const viewTop = -this.scrollY;
        const viewBottom = viewTop + this.height;

        const gridSpacing = 50;
        const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
        const gridStartX = this.width - timePhasePx;

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
                    g.lineStyle(1, 0x333333, 1); 
                    for (let x = gridStartX; x >= 0; x -= gridSpacing) {
                        g.moveTo(x, yOffset);
                        g.lineTo(x, yOffset + this.rowHeight);
                    }

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
        if (this.app.renderer) {
            this.app.renderer.render(this.app.stage);
        }
    }

    forceResize(): void {
        const container = (this.app?.view as HTMLCanvasElement)?.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && this.app?.renderer) {
            this.width = rect.width;
            this.height = rect.height;
            this.app.renderer.resize(this.width, this.height);
            requestAnimationFrame(() => {
                if (this.app?.renderer && this.app.stage) {
                    this.app.renderer.render(this.app.stage);
                }
            });
        }
    }
}