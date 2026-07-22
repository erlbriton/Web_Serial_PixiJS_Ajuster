// js/oscilloscope/pixiOscilloscope.ts
import { MonitorModel } from "../model/monitorModel.js";
import { ScopeLayout, RowGeometry } from "../model/scopeLayout.js";
import { calculateMaxValues } from "./parts_pixiOscilloscope/dataProcessor.js";
import { updateScrollbar, handleWheelScroll } from "./parts_pixiOscilloscope/scrollbar.js";
import { drawWaveform as drawWaveformExternal } from "./parts_pixiOscilloscope/waveformRenderer.js";
import { handleCanvasClick } from "./parts_pixiOscilloscope/canvasInteraction.js";
import { generateTableRows } from "./parts_pixiOscilloscope/tableUI.js";
import { initPixiApp } from "./parts_pixiOscilloscope/pixiInit.js";

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
    private maxValues: number[] = [];
    private highlighter: HTMLDivElement;
    private selectedRow: HTMLElement | null = null;

    constructor(containerId: string, model: MonitorModel) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Контейнер "${containerId}" не найден!`);

        this.containerElement = container;

        const rect = container.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 600;

        // === Инициализация PIXI вынесена в отдельный модуль ===
        const pixiInit = initPixiApp(container, this.width, this.height, 0x000000);
        this.app = pixiInit.app;
        this.stageContainer = pixiInit.stageContainer;
        this.backgroundGraphics = pixiInit.backgroundGraphics;
        this.waveformGraphics = pixiInit.waveformGraphics;
                this.layout = new ScopeLayout();
        // =======================================================

        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

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
            updateScrollbar(this.scrollY, this.height, this.scrollbarTrack, this.scrollbarThumb);

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
                updateScrollbar(this.scrollY, this.height, this.scrollbarTrack, this.scrollbarThumb);
                this.needsRedraw = true;
                
                if (this.highlighter && this.selectedRow) {
                    const rowRect = this.selectedRow.getBoundingClientRect();
                    const containerRect = this.containerElement.getBoundingClientRect();
                    const top = rowRect.top - containerRect.top;
                    
                    if (top >= 0 && top < this.height) {
                        this.highlighter.style.display = 'block';
                        this.highlighter.style.top = `${top}px`;
                    } else {
                        this.highlighter.style.display = 'none';
                    }
                }
            }, { passive: true });
        }

        this.app.ticker.add(() => {
            if (this.needsRedraw) {
                this.draw(this.lastBuffers);
                this.needsRedraw = false;
            }
        });

        container.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const result = handleWheelScroll(
                e.deltaY,
                this.scrollY,
                this.height,
                this.stageContainer!,
                this.scrollbarTrack,
                this.scrollbarThumb,
                this.tableWrapper
            );
            this.scrollY = result.newScrollY;
            this.needsRedraw = result.needsRedraw;
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

        this.highlighter = document.createElement('div');
        this.highlighter.style.cssText = 'position:absolute; left:0; width:100%; background-color:rgba(152, 251, 152, 0.4); pointer-events:none; z-index:5; display:none;';
        container.appendChild(this.highlighter);

        (this.app.view as HTMLCanvasElement).addEventListener('click', (e: MouseEvent) => {
            const model = (window as any).oscModel as MonitorModel;
            if (!model) return;

            const selectedRef = { current: this.selectedRow };

            handleCanvasClick(
                e,
                this.app.view as HTMLCanvasElement,
                this.scrollY,
                this.containerElement.getBoundingClientRect(),
                model,
                selectedRef,
                this.highlighter
            );

            this.selectedRow = selectedRef.current;
        });

        this.needsRedraw = true;
    }

    updateLayout(model: MonitorModel): void {
        this.layout.recalculate(model);
        this.needsRedraw = true;
    }

    draw(buffers?: any[]): void {
        if (buffers) {
            this.lastBuffers = buffers;
        }

        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const visibleRows = this.layout.getVisibleRows(this.scrollY, this.height);
        if (this.lastBuffers) {
            calculateMaxValues(this.lastBuffers, this.maxValues);
        }

        let visibleIndex = 0;
        let discreteCounter = 0;

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

                const currentRow = model.rows[rowGeom.channelIndex];
                const isDiscrete = currentRow && String(currentRow.signal.dataType || '').trim() === 'TBit';

                const waveColor = isDiscrete 
                    ? ((discreteCounter % 2 === 0) ? 0x00BFFF : 0x8B4513) 
                    : this.brightColors[rowGeom.channelIndex % 10];
                
                if (isDiscrete) {
                    discreteCounter++;
                }

                drawWaveformExternal(wave, data, rowGeom, isDiscrete, waveColor, this.width, this.maxValues);
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

    forceResize(): void {
        const container = (this.app?.view as HTMLCanvasElement)?.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && this.app?.renderer) {
            this.app.renderer.resize(rect.width, rect.height);
            this.needsRedraw = true;
        }
    }

    updateRows(rowCount?: number, types?: string[]): void {
        const model = (window as any).oscModel as MonitorModel;
        if (model) {
            this.layout.recalculate(model);
            this.needsRedraw = true;
            console.log(`✅ DEBUG: updateRows вызван через мостик. Строк в модели: ${model.rowCount}`);

            const bodyContainer = document.querySelector('#osc-grid-body') as HTMLElement;
            if (bodyContainer) {
                generateTableRows(
                    model,
                    bodyContainer,
                    this.containerElement,
                    this.highlighter,
                    (rowDiv: HTMLElement) => {
                        bodyContainer.querySelectorAll('.osc-data-row').forEach((row: Element) => {
                            (row as HTMLElement).classList.remove('selected');
                        });

                        rowDiv.classList.add('selected');
                        this.selectedRow = rowDiv;
                    }
                );
            }
        } else {
            console.warn('⚠️ updateRows вызван, но oscModel еще не создан');
        }
    }
}