// js/oscilloscope/pixiOscilloscope.ts
import { MonitorModel } from "../model/monitorModel.js";
import { ScopeLayout } from "../model/scopeLayout.js";
import { handleWheelScroll } from "./parts_pixiOscilloscope/scrollbar.js";
import { handleCanvasClick, handleCanvasContextMenu, createHighlighter } from "./parts_pixiOscilloscope/canvasInteraction.js";
import { generateTableRows } from "./parts_pixiOscilloscope/tableUI.js";
import { initPixiApp, setupResizeObserver } from "./parts_pixiOscilloscope/pixiInit.js";
import { initScrollbar } from "./parts_pixiOscilloscope/scrollbarDom.js";
import { renderOscilloscope } from "./parts_pixiOscilloscope/rendererManager.js";

interface RingBuffer {
    getLinearData: () => number[];
}

// Константы SVG-иконок для смены внешнего вида кнопки
const ICON_EXPAND = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
const ICON_COLLAPSE = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;

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
    
    private needsRedraw: boolean = true;
    private lastBuffers?: any[];
    private maxValues: number[] = [];
    private highlighter: HTMLDivElement;
    private selectedRow: HTMLElement | null = null;

    private isFullscreen: boolean = false;

    constructor(containerId: string, model: MonitorModel) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Контейнер "${containerId}" не найден!`);

        this.containerElement = container;

        const rect = container.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 600;

        const pixiInit = initPixiApp(container, this.width, this.height, 0x000000);
        this.app = pixiInit.app;
        this.stageContainer = pixiInit.stageContainer;
        this.backgroundGraphics = pixiInit.backgroundGraphics;
        this.waveformGraphics = pixiInit.waveformGraphics;
        this.layout = new ScopeLayout();

        this.brightColors = [
            0x00FF00, 0x00FFFF, 0xFF00FF, 0xFFFF00, 0xFF4500,
            0x0099FF, 0xFF0088, 0xADFF2F, 0xFFFFFF, 0x7B68EE
        ];

        this.highlighter = createHighlighter(container);

        const oscContainer = container.closest('.osc-container');
        if (oscContainer) {
            this.tableWrapper = oscContainer.querySelector('.osc-table-wrapper') as HTMLElement;
        }

        const scrollbar = initScrollbar(
            container,
            this.containerElement,
            this.stageContainer!,
            this.tableWrapper,
            this.highlighter,
            () => this.scrollY,
            () => this.height,
            () => this.selectedRow,
            (y: number) => { this.scrollY = y; },
            () => { this.needsRedraw = true; }
        );
        this.scrollbarTrack = scrollbar.track;
        this.scrollbarThumb = scrollbar.thumb;

        setupResizeObserver(container, this.app, {
            width: this.width,
            height: this.height,
            needsRedraw: this.needsRedraw,
            setWidth: (w: number) => { this.width = w; },
            setHeight: (h: number) => { this.height = h; },
            setNeedsRedraw: () => { this.needsRedraw = true; }
        });

        // ПЕРЕРИСОВКА НА КАЖДОМ КАДРЕ:
        this.app.ticker.add(() => {
            this.draw(this.lastBuffers);
            this.needsRedraw = false;
        });

        // Обработчик колеса прокрутки на контейнере
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

        // Надежный поиск элемента canvas внутри контейнера или через app.view
        const canvasElement = container.querySelector('canvas') || (this.app?.view as HTMLCanvasElement);

        if (canvasElement) {
            // Обработчик клика на канвас (левая кнопка)
            canvasElement.addEventListener('click', (e: MouseEvent) => {
                const model = (window as any).oscModel as MonitorModel;
                if (!model) return;

                const selectedRef = { current: this.selectedRow };

                handleCanvasClick(
                    e,
                    canvasElement,
                    this.scrollY,
                    this.containerElement.getBoundingClientRect(),
                    model,
                    selectedRef,
                    this.highlighter,
                    (newSelectedRow: HTMLElement | null) => {
                        this.selectedRow = newSelectedRow;
                    }
                );
            });

            // Обработчик правого клика на канвас (контекстное меню)
            canvasElement.addEventListener('contextmenu', (e: MouseEvent) => {
                const model = (window as any).oscModel as MonitorModel;
                if (!model) return;

                const selectedRef = { current: this.selectedRow };

                handleCanvasContextMenu(
                    e,
                    canvasElement,
                    this.scrollY,
                    this.containerElement.getBoundingClientRect(),
                    model,
                    selectedRef,
                    this.highlighter,
                    (newSelectedRow: HTMLElement | null) => {
                        this.selectedRow = newSelectedRow;
                    },
                    () => {
                        this.updateLayout(model);
                        this.updateRows();
                    }
                );
            });
        } else {
            console.error("❌ PixiOscilloscope: Не удалось найти элемент canvas для назначения обработчиков событий!");
        }

        // Инициализация клика по кнопке "Распахнуть окно"
        this.initFullscreenButton();

        this.needsRedraw = true;
    }

    private initFullscreenButton(): void {
        const btn = document.getElementById('osc-btn-fullscreen') as HTMLButtonElement | null;
        if (!btn) return;

        const oscContainer = this.containerElement.closest('.osc-container') as HTMLElement;
        if (!oscContainer) return;

        btn.addEventListener('click', () => {
            this.isFullscreen = !this.isFullscreen;

            if (this.isFullscreen) {
                oscContainer.classList.add('fullscreen-mode');
                btn.innerHTML = ICON_COLLAPSE;
                btn.title = 'Свернуть окно';
            } else {
                oscContainer.classList.remove('fullscreen-mode');
                btn.innerHTML = ICON_EXPAND;
                btn.title = 'Распахнуть окно';
            }

            // Выжидаем кадр обновления стилей DOM и инициируем событие ресайза
            requestAnimationFrame(() => {
                this.forceResize();
                window.dispatchEvent(new Event('resize'));
            });
        });
    }

    updateLayout(model: MonitorModel): void {
        this.layout.recalculate(model);
        this.needsRedraw = true;
    }

    draw(buffers?: any[]): void {
        if (buffers) {
            this.lastBuffers = buffers;
        }

        renderOscilloscope(
            this.lastBuffers,
            this.layout,
            this.scrollY,
            this.height,
            this.width,
            this.maxValues,
            this.backgroundGraphics,
            this.waveformGraphics,
            this.brightColors
        );
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
            // Перед перерасчетом layout синхронизируем актуальную модель
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
                    },
                    () => {
                        this.updateLayout(model);
                        this.updateRows();
                    }
                );
            }
        } else {
            console.warn('⚠️ updateRows вызван, но oscModel еще не создан');
        }
    }
}