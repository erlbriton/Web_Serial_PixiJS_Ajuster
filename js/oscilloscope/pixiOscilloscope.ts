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
    private graphicsList: any[];
    
    // Новая архитектура
    private layout: ScopeLayout;
    private tableWrapper: HTMLElement | null = null;

    constructor(containerId: string, model: MonitorModel) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Контейнер "${containerId}" не найден!`);

        const rect = container.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 600;
        
        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

        // Инициализация PIXI
        // @ts-ignore
        this.app = new PIXI.Application({
            width: 800, height: 600, backgroundColor: 0x000000, antialias: true
        });
        (this.app.view as HTMLCanvasElement).style.cssText = "width:100%;height:100%;display:block;";
        this.app.ticker.autoStart = false;
        this.app.ticker.stop();
        container.appendChild(this.app.view as HTMLCanvasElement);

        // Находим обертку таблицы для синхронизации скролла
        const oscContainer = container.closest('.osc-container');
        if (oscContainer) {
            this.tableWrapper = oscContainer.querySelector('.osc-table-wrapper') as HTMLElement;
            // ЕДИНЫЙ СКРОЛЛ: Таблица управляет всем
            this.tableWrapper.addEventListener('scroll', () => {
                this.scrollY = this.tableWrapper!.scrollTop;
                this.stageContainer.y = -this.scrollY;
                this.draw(); // Перерисовываем при скролле
            }, { passive: true });
        }

        // Контейнер для графики
        // @ts-ignore
        this.stageContainer = new PIXI.Container();
        this.app.stage.addChild(this.stageContainer);

        // Пул графики (с запасом)
        this.graphicsList = [];
        for (let i = 0; i < 300; i++) {
            // @ts-ignore
            const g = new PIXI.Graphics();
            this.stageContainer.addChild(g);
            this.graphicsList.push(g);
        }

        // Инициализация Layout и первая отрисовка
        this.layout = new ScopeLayout();
        this.layout.recalculate(model);
        this.draw();

        // Ресайз
        new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    this.width = width;
                    this.height = height;
                    this.app.renderer.resize(width, height);
                    this.draw();
                }
            }
        }).observe(container);
    }

    /**
     * Вызывается ИЗВНЕ, когда изменилась высота/видимость строк в модели
     */
    updateLayout(model: MonitorModel): void {
        this.layout.recalculate(model);
        this.draw();
    }

    /**
     * ГЛАВНЫЙ МЕТОД ОТРИСОВКИ
     * Использует геометрию из ScopeLayout, а НЕ DOM-координаты
     */
        draw(buffers?: any[]): void {
       // console.log("🎨 draw() вызван! scrollY:", this.scrollY, "height:", this.height, "buffers:", buffers?.length);
           if (buffers && buffers[0]) {
      // console.log(" Длина первого буфера:", buffers[0].getLinearData().length);
   }
        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const visibleRows = this.layout.getVisibleRows(this.scrollY, this.height);
        //console.log(`📏 Видимых строк: ${visibleRows.length}`);

        let visibleIndex = 0;
        let drawnCount = 0;

        for (const rowGeom of visibleRows) {
            const g = this.graphicsList[visibleIndex];
            if (!g) break;

            // Читаем данные ИЗ ПЕРЕДАННЫХ BUFFERS, а не из модели!
            const data = buffers && buffers[rowGeom.channelIndex] 
                ? buffers[rowGeom.channelIndex].getLinearData() 
                : null;

            if (data && data.length > 1) {
                g.visible = true;
                g.clear();
                g.beginFill(0x1a1a1a);
                g.drawRect(0, rowGeom.y, this.width, rowGeom.height);
                g.endFill();
                g.lineStyle(1, 0x555555, 1);
                g.moveTo(0, rowGeom.y + rowGeom.height - 1);
                g.lineTo(this.width, rowGeom.y + rowGeom.height - 1);
                this.drawWaveform(g, data, rowGeom, false);
              
// g.beginFill(0xFF0000); // Красный цвет
// g.drawRect(0, rowGeom.y, this.width, rowGeom.height);
// g.endFill();
                drawnCount++;
            } else {
                g.visible = false;
            }
            visibleIndex++;
        }

        for (let j = visibleIndex; j < this.graphicsList.length; j++) {
            this.graphicsList[j].visible = false;
        }

        //console.log(`✅ Отрисовано графиков: ${drawnCount}`);
        if (this.app.renderer) {
            this.app.renderer.render(this.app.stage);
        }
    }
        private drawWaveform(g: any, dataRaw: Float32Array | number[], geom: RowGeometry, isDiscrete: boolean): void {
        // Безопасное приведение к number[] для совместимости с логикой отрисовки
        const data = Array.from(dataRaw); 
        
        const { y, height } = geom;
        const gridSpacing = 50;
        const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
        const gridStartX = this.width - timePhasePx;

        // ... остальной код метода остается без изменений ...

        // Сетка времени
        g.lineStyle(1, 0x333333, 1);
        for (let x = gridStartX; x >= 0; x -= gridSpacing) {
            g.moveTo(x, y);
            g.lineTo(x, y + height - 1);
        }

        const color = isDiscrete ? 0x56CCF2 : this.brightColors[geom.channelIndex % 10];

        if (isDiscrete) {
            // Дискретный сигнал
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
            // Аналоговый сигнал
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
            this.draw();
        }
    }
    /**
     * Метод-мостик для совместимости со старым кодом file-loader.ts
     * Принимает rowCount и buffers, но игнорирует их, используя модель из window.oscModel
     */
    updateRows(rowCount?: number, types?: string[]): void {
        const model = (window as any).oscModel as MonitorModel;
        if (model) {
            this.layout.recalculate(model);
            this.draw();
            console.log(`✅ DEBUG: updateRows вызван через мостик. Строк в модели: ${model.rowCount}`);
        } else {
            console.warn('⚠️ updateRows вызван, но oscModel еще не создан');
        }
    }
}