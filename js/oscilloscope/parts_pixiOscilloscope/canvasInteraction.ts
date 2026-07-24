// js/oscilloscope/parts_pixiOscilloscope/canvasInteraction.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { openSignalConfigDialog } from "./signalConfigDialog.js";
import { openRowContextMenu } from "./openMenu.js";

export function createHighlighter(container: HTMLElement): HTMLDivElement {
    const highlighter = document.createElement('div');
    highlighter.style.cssText = 'position:absolute; left:0; width:100%; background-color:rgba(152, 251, 152, 0.4); pointer-events:none; z-index:5; display:none;';
    container.appendChild(highlighter);
    return highlighter;
}

// Поиск индекса среди ВИДИМЫХ строк по координате Y
function getRowIndexByY(model: MonitorModel, absoluteClickY: number): number {
    let currentY = 0;
    for (let i = 0; i < model.rows.length; i++) {
        const row = model.rows[i];
        if (row.visible === false) continue; // Пропускаем скрытые строки

        const rowHeight = row.height || 20;
        if (absoluteClickY >= currentY && absoluteClickY < currentY + rowHeight) {
            return i; // Возвращаем реальный индекс строки в model.rows
        }
        currentY += rowHeight;
    }
    return -1;
}

// Выделение строки в интерфейсе
export function selectRowByIndex(
    clickedRowIndex: number,
    containerRect: DOMRect,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement,
    onSelectionChange: (row: HTMLElement | null) => void
): void {
    if (clickedRowIndex >= 0) {
        // Находим все видимые элементы строк в DOM (пропуская display: none)
        const allVisibleDivs = Array.from(
            document.querySelectorAll('#osc-grid-body .osc-data-row')
        ).filter(el => (el as HTMLElement).style.display !== 'none') as HTMLElement[];

        // Находим порядковый номер среди видимых строк
        const targetDiv = allVisibleDivs.find(div => {
            // Если нужно найти по прямому индексу visible-массива
            return true; 
        });

        // Находим нужный div по кликнутой позиции среди отображаемых
        const rowDiv = allVisibleDivs[clickedRowIndex];

        if (rowDiv) {
            allVisibleDivs.forEach((row: HTMLElement) => {
                row.classList.remove('selected');
            });

            rowDiv.classList.add('selected');
            selectedRowRef.current = rowDiv;
            onSelectionChange(rowDiv);

            const rowRect = rowDiv.getBoundingClientRect();
            const top = rowRect.top - containerRect.top;
            const height = rowRect.height;

            if (top >= 0 && top < containerRect.height) {
                highlighter.style.display = 'block';
                highlighter.style.top = `${top}px`;
                highlighter.style.height = `${height}px`;
            } else {
                highlighter.style.display = 'none';
            }
        }
    } else {
        const allRows = document.querySelectorAll('#osc-grid-body .osc-data-row');
        allRows.forEach((row: Element) => {
            (row as HTMLElement).classList.remove('selected');
        });
        
        selectedRowRef.current = null;
        onSelectionChange(null);
        highlighter.style.display = 'none';
    }
}

// Обработка ЛЕВОГО клика по холсту
export function handleCanvasClick(
    e: MouseEvent,
    canvasView: HTMLCanvasElement,
    scrollY: number,
    containerRect: DOMRect,
    model: MonitorModel,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement,
    onSelectionChange: (row: HTMLElement | null) => void
): void {
    if (e.button !== 0) return;

    const canvasRect = canvasView.getBoundingClientRect();
    const absoluteClickY = (e.clientY - canvasRect.top) + scrollY;
    
    // Получаем индекс кликнутой строки среди видимых
    const visibleRows = model.rows.filter(r => r.visible !== false);
    let currentY = 0;
    let visibleIndex = -1;

    for (let i = 0; i < visibleRows.length; i++) {
        const rowHeight = visibleRows[i].height || 20;
        if (absoluteClickY >= currentY && absoluteClickY < currentY + rowHeight) {
            visibleIndex = i;
            break;
        }
        currentY += rowHeight;
    }

    selectRowByIndex(visibleIndex, containerRect, selectedRowRef, highlighter, onSelectionChange);
}

// Обработка ПРАВОГО клика по холсту (контекстное меню)
export function handleCanvasContextMenu(
    e: MouseEvent,
    canvasView: HTMLCanvasElement,
    scrollY: number,
    containerRect: DOMRect,
    model: MonitorModel,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement,
    onSelectionChange: (row: HTMLElement | null) => void,
    onSaveConfig?: () => void
): void {
    e.preventDefault();
    e.stopPropagation();

    const canvasRect = canvasView.getBoundingClientRect();
    const absoluteClickY = (e.clientY - canvasRect.top) + scrollY;

    // Считаем индекс строго по массиву видимых элементов
    const visibleRows = model.rows.filter(r => r.visible !== false);
    let currentY = 0;
    let visibleIndex = -1;

    for (let i = 0; i < visibleRows.length; i++) {
        const rowHeight = visibleRows[i].height || 20;
        if (absoluteClickY >= currentY && absoluteClickY < currentY + rowHeight) {
            visibleIndex = i;
            break;
        }
        currentY += rowHeight;
    }

    selectRowByIndex(visibleIndex, containerRect, selectedRowRef, highlighter, onSelectionChange);

    if (visibleIndex >= 0) {
        const targetRow = visibleRows[visibleIndex];

        if (!targetRow) return;

        openRowContextMenu({
            x: e.clientX,
            y: e.clientY,
            onProperties: () => {
                openSignalConfigDialog(targetRow, () => {
                    if (onSaveConfig) onSaveConfig();
                });
            },
            onDelete: () => {
                targetRow.visible = false;
                selectRowByIndex(-1, containerRect, selectedRowRef, highlighter, onSelectionChange);
                if (onSaveConfig) onSaveConfig();
            }
        });
    }
}