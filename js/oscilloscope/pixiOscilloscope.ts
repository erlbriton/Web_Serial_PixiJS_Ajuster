interface RingBuffer {
    getLinearData: () => number[];
}

export class PixiOscilloscope {
    private width: number;
    private height: number;
    private rowHeight: number = 20;
    private totalRows: number;
    private scrollY: number = 0;
    private brightColors: number[];
    private app: any;
    private stageContainer: any;
    private graphicsList: any[];
    private rowTypes: string[] = []; // Хранит типы параметров ('TBit', 'TWord' и т.д.)

    constructor(containerId: string, rowCount: number, types?: string[]) {
        this.totalRows = rowCount;
        this.rowTypes = types || [];
        
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

    /**
     * Позволяет динамически обновить типы параметров для корректного отображения
     */
    setRowTypes(types: string[]): void {
        this.rowTypes = types;
    }

    draw(buffers: (RingBuffer | null)[]): void {
        const viewTop = -this.scrollY;
        const viewBottom = viewTop + this.height;

        const gridSpacing = 50;
        const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
        const gridStartX = this.width - timePhasePx;

        // Переменная для отслеживания и чередования цветов подряд идущих дискретных сигналов
        let consecutiveDiscreteCount = 0;

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
            
            // Определяем, дискретный ли параметр:
            // Либо тип явно задан как 'TBit', либо автоопределяем по содержимому буфера (только 0 и 1)
            let isDiscrete = this.rowTypes[i] === 'TBit';
            if (this.rowTypes[i] === undefined && buffer) {
                const data = buffer.getLinearData();
                if (data && data.every(v => v === 0 || v === 1)) {
                    isDiscrete = true;
                }
            }

            // Выбираем цвет для текущего канала
            let color: number;
            if (isDiscrete) {
                const DISCRETE_BLUE = 0x56CCF2;   // Светло-синий (голубой) как на скриншоте
                const DISCRETE_BROWN = 0xF2C94C;  // Коричнево-янтарный как на скриншоте
                
                // Если идут подряд, цвета чередуются: синий, коричневый, синий, коричневый...
                color = (consecutiveDiscreteCount % 2 === 0) ? DISCRETE_BLUE : DISCRETE_BROWN;
                consecutiveDiscreteCount++;
            } else {
                // Если встретился аналоговый параметр, сбрасываем счетчик подряд идущих дискретных
                consecutiveDiscreteCount = 0;
                color = this.brightColors[i % 10];
            }

            if (buffer) {
                const data = buffer.getLinearData();
                if (data && data.length > 1) {
                    // 1. Отрисовка фоновой сетки
                    g.lineStyle(1, 0x333333, 1); 
                    for (let x = gridStartX; x >= 0; x -= gridSpacing) {
                        g.moveTo(x, yOffset);
                        g.lineTo(x, yOffset + this.rowHeight);
                    }

                    if (isDiscrete) {
                        // 2. Отрисовка дискретного параметра (цифровой анализатор)
                        const drawSegment = (xStart: number, xEnd: number, val: number) => {
                            if (xStart <= xEnd) return;
                            if (val !== 0) {
                                // Значение = 1: сплошной заполненный прямоугольник с отступами сверху и снизу в 2px
                                g.lineStyle(0);
                                g.beginFill(color, 1);
                                g.drawRect(xEnd, yOffset + 2, xStart - xEnd, this.rowHeight - 4);
                                g.endFill();
                            } else {
                                // Значение = 0: тонкая аккуратная линия у нижней границы строки (толщиной 1.5px)
                                g.lineStyle(1.5, color, 1);
                                g.moveTo(xStart, yOffset + this.rowHeight - 2);
                                g.lineTo(xEnd, yOffset + this.rowHeight - 2);
                            }
                        };

                        let segmentStartVal = data[data.length - 1];
                        let segmentStartX = this.width;

                        for (let j = 0; j < data.length; j++) {
                            const x = this.width - (j * 2);
                            if (x < 0) {
                                drawSegment(segmentStartX, 0, segmentStartVal);
                                break;
                            }
                            const val = data[data.length - 1 - j];
                            if (val !== segmentStartVal) {
                                drawSegment(segmentStartX, x, segmentStartVal);
                                segmentStartVal = val;
                                segmentStartX = x;
                            }
                        }
                        
                        const finalX = this.width - (data.length * 2);
                        if (finalX > 0) {
                            drawSegment(segmentStartX, finalX, segmentStartVal);
                        }

                    } else {
                        // 3. Отрисовка классического аналогового параметра (линия)
                        g.lineStyle(1, color, 1);
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

    updateRows(rowCount: number, types?: string[]): void {
        // Очищаем старые графические объекты
        this.graphicsList.forEach(g => this.stageContainer.removeChild(g));
        this.graphicsList = [];
        this.totalRows = rowCount;
        this.rowTypes = types || [];

        // Создаем новые
        for (let i = 0; i < this.totalRows; i++) {
            // @ts-ignore
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }
        
        // Сбрасываем прокрутку, если она стала неактуальной
        this.scrollY = 0;
        this.stageContainer.y = 0;
        
        console.log(`DEBUG: Осциллограф обновлен. Графиков теперь: ${this.totalRows}`);
    }
}