// js/oscilloscope/parts_pixiOscilloscope/canvasInteraction.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { openSignalConfigDialog } from "./signalConfigDialog.js";

export function createHighlighter(container: HTMLElement): HTMLDivElement {
    const highlighter = document.createElement('div');
    highlighter.style.cssText = 'position:absolute; left:0; width:100%; background-color:rgba(152, 251, 152, 0.4); pointer-events:none; z-index:5; display:none;';
    container.appendChild(highlighter);
    return highlighter;
}

// Поиск индекса строки по координате Y
function getRowIndexByY(model: MonitorModel, absoluteClickY: number): number {
    let currentY = 0;
    for (let i = 0; i < model.rows.length; i++) {
        const rowHeight = model.rows[i].height;
        if (absoluteClickY >= currentY && absoluteClickY < currentY + rowHeight) {
            return i;
        }
        currentY += rowHeight;
    }
    return -1;
}

// Выделение строки в интерфейсе
function selectRowByIndex(
    clickedRowIndex: number,
    containerRect: DOMRect,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement,
    onSelectionChange: (row: HTMLElement | null) => void
): void {
    if (clickedRowIndex >= 0) {
        const allRows = document.querySelectorAll('#osc-grid-body .osc-data-row');
        if (allRows[clickedRowIndex]) {
            const rowDiv = allRows[clickedRowIndex] as HTMLElement;

            allRows.forEach((row: Element) => {
                (row as HTMLElement).classList.remove('selected');
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
    if (e.button !== 0) return; // Пропускаем все клики, кроме левой кнопки

    const canvasRect = canvasView.getBoundingClientRect();
    const absoluteClickY = (e.clientY - canvasRect.top) + scrollY;
    const clickedRowIndex = getRowIndexByY(model, absoluteClickY);

    selectRowByIndex(clickedRowIndex, containerRect, selectedRowRef, highlighter, onSelectionChange);
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
    const clickedRowIndex = getRowIndexByY(model, absoluteClickY);

    selectRowByIndex(clickedRowIndex, containerRect, selectedRowRef, highlighter, onSelectionChange);

    if (clickedRowIndex >= 0) {
        const targetRow = model.rows[clickedRowIndex];
        openSignalConfigDialog(targetRow, () => {
            if (onSaveConfig) onSaveConfig();
        });
    }
}