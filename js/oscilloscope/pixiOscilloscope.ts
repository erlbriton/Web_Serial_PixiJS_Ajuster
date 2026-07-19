// js/oscilloscope/pixiOscilloscope.ts
import { MonitorModel } from "../model/monitorModel.js";
import { ScopeLayout, RowGeometry } from "../model/scopeLayout.js";

interface RingBuffer {
    getLinearData: () => number[];
}

export class PixiOscilloscope {
    private width: number;
    private height: number;
    private scrollY: number = 0;
    private brightColors: number[];
    private app: any;
    private stageContainer: any;
    private backgroundGraphics: any[] = [];
    private waveformGraphics: any[] = [];

    private layout: ScopeLayout;
    private tableWrapper: HTMLElement | null = null;
    private containerElement: HTMLElement;

    private scrollbarTrack: HTMLDivElement;
    private scrollbarThumb: HTMLDivElement;
    private isDraggingScrollbar: boolean = false;
    private scrollbarDragStartY: number = 0;
    private scrollbarDragStartScroll: number = 0;

    private needsRedraw: boolean = true;
    private lastBuffers?: any[];

    constructor(containerId: string, model: MonitorModel) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Контейнер "${containerId}" не найден!`);

        this.containerElement = container;

        const rect = container.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 600;

        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

        // @ts-ignore
        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0x000000,
            antialias: true,
            autoStart: true
        });
        (this.app.view as HTMLCanvasElement).style.cssText = "width:100%;height:100%;display:block;";
        container.appendChild(this.app.view as HTMLCanvasElement);

        this.scrollbarTrack = document.createElement('div');
        this.scrollbarTrack.style.cssText = 'position:absolute; right:2px; top:2px; bottom:2px; width:8px; background:rgba(255,255,255,0.1); border-radius:4px; z-index:50; cursor:pointer;';
        this.scrollbarThumb = document.createElement('div');
        this.scrollbarThumb.style.cssText = 'position:absolute; left:0; top:0; width:100%; background:rgba(0, 85, 255, 0.6); border-radius:4px; pointer-events:none;';
        this.scrollbarTrack.appendChild(this.scrollbarThumb);
        container.appendChild(this.scrollbarTrack);

        this.scrollbarTrack.addEventListener('mousedown', (e: MouseEvent) => {
            this.isDraggingScrollbar = true;
            this.scrollbarDragStartY = e.clientY;
            this.scrollbarDragStartScroll = this.scrollY;
            this.scrollbarThumb.style.background = 'rgba(0, 85, 255, 0.9)';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.isDraggingScrollbar) return;

            const model = (window as any).oscModel as MonitorModel;
            if (!model) return;

            const totalHeight = model.rows.reduce((sum: number, row: any) => sum + row.height, 0);
            const maxScroll = Math.max(0, totalHeight - this.height);

            const deltaY = e.clientY - this.scrollbarDragStartY;
            const trackHeight = this.scrollbarTrack.offsetHeight;
            const scrollRatio = maxScroll / trackHeight;

            this.scrollY = this.scrollbarDragStartScroll + (deltaY * scrollRatio);
            this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));

            this.stageContainer.y = -this.scrollY;
            this.updateScrollbar();

            if (this.tableWrapper) {
                this.tableWrapper.scrollTop = this.scrollY;
            }

            this.needsRedraw = true;
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingScrollbar) {
                this.isDraggingScrollbar = false;
                this.scrollbarThumb.style.background = 'rgba(0, 85, 255, 0.6)';
            }
        });

        const oscContainer = container.closest('.osc-container');
        if (oscContainer) {
            this.tableWrapper = oscContainer.querySelector('.osc-table-wrapper') as HTMLElement;

            this.tableWrapper.addEventListener('scroll', () => {
                this.scrollY = this.tableWrapper!.scrollTop;
                this.stageContainer.y = -this.scrollY;
                this.updateScrollbar();
                this.needsRedraw = true;
            }, { passive: true });
        }

        // @ts-ignore
        this.stageContainer = new PIXI.Container();
        this.app.stage.addChild(this.stageContainer);

        for (let i = 0; i < 300; i++) {
            // @ts-ignore
            const bg = new PIXI.Graphics();
            // @ts-ignore
            const wave = new PIXI.Graphics();

            this.stageContainer.addChild(bg);
            this.stageContainer.addChild(wave);

            this.backgroundGraphics.push(bg);
            this.waveformGraphics.push(wave);
        }

        this.layout = new ScopeLayout();
        this.layout.recalculate(model);

        this.app.ticker.add(() => {
            if (this.needsRedraw) {
                this.draw(this.lastBuffers);
                this.needsRedraw = false;
            }
        });

        container.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();

            const currentModel = (window as any).oscModel as MonitorModel;
            if (!currentModel) return;

            const totalHeight = currentModel.rows.reduce((sum: number, row: any) => sum + row.height, 0);
            const maxScroll = Math.max(0, totalHeight - this.height);

            this.scrollY += e.deltaY * 1.5;
            this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));

            this.stageContainer.y = -this.scrollY;
            this.updateScrollbar();

            if (this.tableWrapper) {
                this.tableWrapper.scrollTop = this.scrollY;
            }

            this.needsRedraw = true;
        }, { passive: false });

        new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    this.width = width;
                    this.height = height;
                    this.app.renderer.resize(width, height);
                    this.needsRedraw = true;
                }
            }
        }).observe(container);

        this.needsRedraw = true;
    }

    updateLayout(model: MonitorModel): void {
        this.layout.recalculate(model);
        this.needsRedraw = true;
    }

    private updateScrollbar(): void {
        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const totalHeight = model.rows.reduce((sum: number, row: any) => sum + row.height, 0);

        if (totalHeight <= this.height) {
            this.scrollbarTrack.style.display = 'none';
            return;
        }
        this.scrollbarTrack.style.display = 'block';

        const thumbHeight = Math.max(20, (this.height / totalHeight) * this.height);
        const maxTop = this.height - thumbHeight;
        const thumbTop = (this.scrollY / (totalHeight - this.height)) * maxTop;

        this.scrollbarThumb.style.height = `${thumbHeight}px`;
        this.scrollbarThumb.style.top = `${thumbTop}px`;
    }

    draw(buffers?: any[]): void {
        if (buffers) {
            this.lastBuffers = buffers;
        }

        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const visibleRows = this.layout.getVisibleRows(this.scrollY, this.height);

        let visibleIndex = 0;

        for (const rowGeom of visibleRows) {
            const bg = this.backgroundGraphics[visibleIndex];
            const wave = this.waveformGraphics[visibleIndex];

            if (!bg || !wave) break;

            const data = this.lastBuffers && this.lastBuffers[rowGeom.channelIndex]
                ? this.lastBuffers[rowGeom.channelIndex].getLinearData()
                : null;

            if (data && data.length > 1) {
                bg.visible = true;
                wave.visible = true;

                bg.clear();
                wave.clear();

                bg.beginFill(0x1a1a1a);
                bg.drawRect(0, rowGeom.y, this.width, rowGeom.height);
                bg.endFill();

                // Яркая линия, совпадающая с CSS
                bg.lineStyle(1, 0x888888, 1);
                bg.moveTo(0, rowGeom.y + rowGeom.height - 1);
                bg.lineTo(this.width, rowGeom.y + rowGeom.height - 1);

                this.drawWaveform(wave, data, rowGeom, false);
            } else {
                bg.visible = false;
                wave.visible = false;
            }
            visibleIndex++;
        }

        for (let j = visibleIndex; j < this.backgroundGraphics.length; j++) {
            this.backgroundGraphics[j].visible = false;
            this.waveformGraphics[j].visible = false;
        }
    }

    private drawWaveform(g: any, dataRaw: Float32Array | number[], geom: RowGeometry, isDiscrete: boolean): void {
        const data = Array.from(dataRaw);
        const { y, height } = geom;
        const gridSpacing = 50;
        const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
        const gridStartX = this.width - timePhasePx;

        g.lineStyle(1, 0x333333, 1);
        for (let x = gridStartX; x >= 0; x -= gridSpacing) {
            g.moveTo(x, y);
            g.lineTo(x, y + height - 1);
        }

        const color = isDiscrete ? 0x56CCF2 : this.brightColors[geom.channelIndex % 10];

        if (isDiscrete) {
            let segStartVal = data[data.length - 1];
            let segStartX = this.width;

            const drawSeg = (x1: number, x2: number, val: number) => {
                if (x1 <= x2) return;
                if (val !== 0) {
                    g.lineStyle(0);
                    g.beginFill(color, 1);
                    const h = Math.max(4, height - 6);
                    g.drawRect(x2, y + (height - h) / 2, x1 - x2, h);
                    g.endFill();
                } else {
                    g.lineStyle(1.5, color, 1);
                    g.moveTo(x1, y + height - 3);
                    g.lineTo(x2, y + height - 3);
                }
            };

            for (let j = 0; j < data.length; j++) {
                const x = this.width - (j * 2);
                if (x < 0) { drawSeg(segStartX, 0, segStartVal); break; }
                const val = data[data.length - 1 - j];
                if (val !== segStartVal) {
                    drawSeg(segStartX, x, segStartVal);
                    segStartVal = val;
                    segStartX = x;
                }
            }
            const finalX = this.width - (data.length * 2);
            if (finalX > 0) drawSeg(segStartX, finalX, segStartVal);

        } else {
            g.lineStyle(1, color, 1);
            let started = false;
            for (let j = 0; j < data.length; j++) {
                const x = this.width - (j * 2);
                if (x < 0) break;
                const val = (data[data.length - 1 - j] / 1100) * (height - 4);
                const py = y + (height - 2 - val);
                if (!started) { g.moveTo(x, py); started = true; }
                else { g.lineTo(x, py); }
            }
        }
    }

    forceResize(): void {
        const container = (this.app?.view as HTMLCanvasElement)?.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && this.app?.renderer) {
            this.app.renderer.resize(rect.width, rect.height);
            this.needsRedraw = true;
        }
    }

    // === ИЗМЕНЕННЫЙ МЕТОД ===
    updateRows(rowCount?: number, types?: string[]): void {
        const model = (window as any).oscModel as MonitorModel;
        if (model) {
            this.layout.recalculate(model);
            this.needsRedraw = true;
            console.log(`✅ DEBUG: updateRows вызван через мостик. Строк в модели: ${model.rowCount}`);

            // === НОВОЕ: Генерация HTML строк для левой панели при загрузке данных ===
            const bodyContainer = document.querySelector('#osc-grid-body') as HTMLElement;
            if (bodyContainer) {
                bodyContainer.innerHTML = ''; // Очищаем контейнер (на случай если file-loader вставил туда что-то старое)
                
                model.rows.forEach((row: any) => {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'osc-data-row';
                    // Высота строки берется из модели, чтобы совпадать с графиком
                    rowDiv.style.height = `${row.height}px`;

                    const hexVal = row.signal.register.toString(16).toUpperCase().padStart(4, '0');
                    const physVal = typeof row.signal.currentValue === 'number' 
                        ? row.signal.currentValue.toFixed(2) 
                        : row.signal.currentValue;

                    rowDiv.innerHTML = `
                        <div class="col col-name" title="${row.signal.name}">${row.signal.name}</div>
                        <div class="col col-hex">${hexVal}</div>
                        <div class="col col-phys">${physVal}</div>
                        <div class="col col-unit">${row.signal.unit}</div>
                        <div class="col col-graph"></div>
                    `;
                    bodyContainer.appendChild(rowDiv);
                });
            }
            // ================================================================

        } else {
            console.warn('⚠️ updateRows вызван, но oscModel еще не создан');
        }
    }
}