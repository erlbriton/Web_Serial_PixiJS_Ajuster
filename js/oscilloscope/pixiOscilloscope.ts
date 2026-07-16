interface RingBuffer {
    getLinearData: () => number[];
}

export class PixiOscilloscope {
    private width: number;
    private height: number;
    private readonly rowHeight: number = 20; // Строгая высота строк 20px
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

        // Инициализируем правый общий скроллбар внутри контейнера холста
        let customScrollbar = container.querySelector('.osc-custom-scrollbar') as HTMLElement;
        if (!customScrollbar) {
            customScrollbar = document.createElement('div');
            customScrollbar.className = 'osc-custom-scrollbar';
            
            const scrollbarContent = document.createElement('div');
            scrollbarContent.className = 'osc-custom-scrollbar-content';
            
            customScrollbar.appendChild(scrollbarContent);
            container.appendChild(customScrollbar);
        }

        const scrollbarContent = customScrollbar.querySelector('.osc-custom-scrollbar-content') as HTMLElement;
        if (scrollbarContent) {
            scrollbarContent.style.height = `${this.totalRows * this.rowHeight}px`;
        }

        // @ts-ignore
        this.stageContainer = new PIXI.Container();
        this.stageContainer.y = 0;
        this.app.stage.addChild(this.stageContainer);

        this.graphicsList = [];
        for (let i = 0; i < this.totalRows; i++) {
            // @ts-ignore
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }

        const triggerRender = () => {
            if (this.app.renderer && this.app.stage) {
                this.app.renderer.render(this.app.stage);
            }
        };

        const oscLeftScroll = (
            container.parentElement?.querySelector('.osc-table-wrapper') ||
            container.closest('.osc-container')?.querySelector('.osc-table-wrapper') ||
            container.closest('.osc-main-area')?.querySelector('.osc-table-wrapper')
        ) as HTMLElement;

        // ЕДИНЫЙ ОБРАБОТЧИК СКРОЛЛА (Правый скроллбар управляет всем)
        customScrollbar.addEventListener('scroll', () => {
            this.scrollY = -customScrollbar.scrollTop;
            this.stageContainer.y = this.scrollY;
            
            if (oscLeftScroll) {
                oscLeftScroll.scrollTop = customScrollbar.scrollTop;
            }
            triggerRender();
        });

        // Скроллинг колесиком мыши над графиками осциллографа
        container.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            customScrollbar.scrollTop += e.deltaY;
        }, { passive: false });

        // Скроллинг левой колонки параметров (колесиком в ней)
        if (oscLeftScroll) {
            oscLeftScroll.addEventListener('wheel', (e: WheelEvent) => {
                e.preventDefault();
                customScrollbar.scrollTop += e.deltaY;
            }, { passive: false });
        }
    }

    setRowTypes(types: string[]): void {
        this.rowTypes = types;
    }

    draw(buffers: (RingBuffer | null)[]): void {
        const viewTop = -this.scrollY;
        const viewBottom = viewTop + this.height;

        const gridSpacing = 50;
        const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
        const gridStartX = this.width - timePhasePx;

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

            // ВРЕМЕННО: Отрисовка ЯРКОЙ разделительной линии под каждой строкой графика
            // Цвет изменен с 0x2d2d2d на 0x555555 (такой же, как border-bottom слева у параметров)
            g.lineStyle(1, 0x555555, 1);
            g.moveTo(0, yOffset + this.rowHeight - 1);
            g.lineTo(this.width, yOffset + this.rowHeight - 1);

            const buffer = buffers[i];
            
            let isDiscrete = this.rowTypes[i] === 'TBit';
            if (this.rowTypes[i] === undefined && buffer) {
                const data = buffer.getLinearData();
                if (data && data.every(v => v === 0 || v === 1)) {
                    isDiscrete = true;
                }
            }

            let color: number;
            if (isDiscrete) {
                const DISCRETE_BLUE = 0x56CCF2;
                const DISCRETE_BROWN = 0xF2C94C;
                
                color = (consecutiveDiscreteCount % 2 === 0) ? DISCRETE_BLUE : DISCRETE_BROWN;
                consecutiveDiscreteCount++;
            } else {
                consecutiveDiscreteCount = 0;
                color = this.brightColors[i % 10];
            }

            if (buffer) {
                const data = buffer.getLinearData();
                if (data && data.length > 1) {
                    // 1. Отрисовка фоновой сетки (вертикальные линии времени)
                    g.lineStyle(1, 0x333333, 1); 
                    for (let x = gridStartX; x >= 0; x -= gridSpacing) {
                        g.moveTo(x, yOffset);
                        // Проводим вертикальные линии сетки, не доходя 1px до разделителя
                        g.lineTo(x, yOffset + this.rowHeight - 1);
                    }

                    if (isDiscrete) {
                        // 2. Отрисовка дискретного параметра (цифровой анализатор)
                        const drawSegment = (xStart: number, xEnd: number, val: number) => {
                            if (xStart <= xEnd) return;
                            if (val !== 0) {
                                g.lineStyle(0);
                                g.beginFill(color, 1);
                                // Высота прямоугольника 14px (отступы 2px сверху и 4px снизу, чтобы не налезать на разделитель)
                                g.drawRect(xEnd, yOffset + 2, xStart - xEnd, this.rowHeight - 6);
                                g.endFill();
                            } else {
                                g.lineStyle(1.5, color, 1);
                                // Линия нуля чуть выше разделительной черты
                                g.moveTo(xStart, yOffset + this.rowHeight - 3);
                                g.lineTo(xEnd, yOffset + this.rowHeight - 3);
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
                        // 3. Отрисовка аналогового параметра (линия)
                        g.lineStyle(1, color, 1);
                        let started = false;
                        for (let j = 0; j < data.length; j++) {
                            const x = this.width - (j * 2);
                            if (x < 0) break;
                            // Сжимаем амплитуду до 16px, оставляя по 2px отступов снизу и сверху
                            const val = (data[data.length - 1 - j] / 1100) * (this.rowHeight - 4);
                            const y = yOffset + (this.rowHeight - 2 - val);
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
        this.graphicsList.forEach(g => this.stageContainer.removeChild(g));
        this.graphicsList = [];
        this.totalRows = rowCount;
        this.rowTypes = types || [];

        for (let i = 0; i < this.totalRows; i++) {
            // @ts-ignore
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }
        
        this.scrollY = 0;
        this.stageContainer.y = 0;
        
        const container = (this.app?.view as HTMLCanvasElement)?.parentElement;
        if (container) {
            let customScrollbar = container.querySelector('.osc-custom-scrollbar') as HTMLElement;
            if (!customScrollbar) {
                customScrollbar = document.createElement('div');
                customScrollbar.className = 'osc-custom-scrollbar';
                
                const scrollbarContent = document.createElement('div');
                scrollbarContent.className = 'osc-custom-scrollbar-content';
                
                customScrollbar.appendChild(scrollbarContent);
                container.appendChild(customScrollbar);
            }
            const scrollbarContent = customScrollbar.querySelector('.osc-custom-scrollbar-content') as HTMLElement;
            if (scrollbarContent) {
                scrollbarContent.style.height = `${this.totalRows * this.rowHeight}px`;
            }
            customScrollbar.scrollTop = 0;
        }
        
        console.log(`DEBUG: Осциллограф обновлен. Графиков теперь: ${this.totalRows}`);
    }
}