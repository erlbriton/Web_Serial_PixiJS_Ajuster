// js/oscilloscope/parts_pixiOscilloscope/scrollbarDom.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { updateScrollbar } from "./scrollbar.js";

export function initScrollbar(
    container: HTMLElement,
    containerElement: HTMLElement,
    stageContainer: any,
    tableWrapper: HTMLElement | null,
    highlighter: HTMLDivElement,
    // Getters для чтения текущего состояния
    getScrollY: () => number,
    getHeight: () => number,
    getSelectedRow: () => HTMLElement | null,
    // Setters для изменения состояния КЛАССА напрямую
    setScrollY: (y: number) => void,
    setNeedsRedraw: () => void
): { track: HTMLDivElement; thumb: HTMLDivElement } {
    
    const track = document.createElement('div');
    track.style.cssText = 'position:absolute; right:2px; top:2px; bottom:2px; width:8px; background:rgba(255,255,255,0.1); border-radius:4px; z-index:50; cursor:pointer;';
    
    const thumb = document.createElement('div');
    thumb.style.cssText = 'position:absolute; left:0; top:0; width:100%; background:rgba(0, 85, 255, 0.6); border-radius:4px; pointer-events:none;';
    
    track.appendChild(thumb);
    container.appendChild(track);

    // Локальное состояние для Drag'n'Drop (не нужно выносить в класс)
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;

    // 1. Начало перетаскивания
    track.addEventListener('mousedown', (e: MouseEvent) => {
        isDragging = true;
        dragStartY = e.clientY;
        dragStartScroll = getScrollY();
        thumb.style.background = 'rgba(0, 85, 255, 0.9)';
        e.preventDefault();
    });

    // 2. Движение мыши
    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        
        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const totalHeight = model.rows.reduce((sum: number, row: any) => sum + row.height, 0);
        const maxScroll = Math.max(0, totalHeight - getHeight());
        const deltaY = e.clientY - dragStartY;
        const trackHeight = track.offsetHeight;
        const scrollRatio = maxScroll / trackHeight;

        let newScrollY = dragStartScroll + (deltaY * scrollRatio);
        newScrollY = Math.max(0, Math.min(newScrollY, maxScroll));

        // ВАЖНО: Обновляем состояние КЛАССА через колбэк
        setScrollY(newScrollY);
        
        stageContainer.y = -newScrollY;
        updateScrollbar(newScrollY, getHeight(), track, thumb);

        if (tableWrapper) {
            tableWrapper.scrollTop = newScrollY;
        }

        setNeedsRedraw();
    });

    // 3. Конец перетаскивания
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            thumb.style.background = 'rgba(0, 85, 255, 0.6)';
        }
    });

    // 4. Синхронизация с прокруткой левой таблицы
    if (tableWrapper) {
        tableWrapper.addEventListener('scroll', () => {
            const newScroll = tableWrapper.scrollTop;
            
            // ВАЖНО: Обновляем состояние КЛАССА через колбэк
            setScrollY(newScroll);
            
            stageContainer.y = -newScroll;
            updateScrollbar(newScroll, getHeight(), track, thumb);
            setNeedsRedraw();

            // Обновление подсветки при скролле таблицы
            const selectedRow = getSelectedRow();
            if (highlighter && selectedRow) {
                const rowRect = selectedRow.getBoundingClientRect();
                const containerRect = containerElement.getBoundingClientRect();
                const top = rowRect.top - containerRect.top;

                if (top >= 0 && top < getHeight()) {
                    highlighter.style.display = 'block';
                    highlighter.style.top = `${top}px`;
                } else {
                    highlighter.style.display = 'none';
                }
            }
        }, { passive: true });
    }

    return { track, thumb };
}