// js/oscilloscope/parts_pixiOscilloscope/canvasInteraction.ts
import { MonitorModel } from "../../model/monitorModel.js";

export function createHighlighter(container: HTMLElement): HTMLDivElement {
    const highlighter = document.createElement('div');
    highlighter.style.cssText = 'position:absolute; left:0; width:100%; background-color:rgba(152, 251, 152, 0.4); pointer-events:none; z-index:5; display:none;';
    container.appendChild(highlighter);
    return highlighter;
}

export function handleCanvasClick(
    e: MouseEvent,
    canvasView: HTMLCanvasElement,
    scrollY: number,
    containerRect: DOMRect,
    model: MonitorModel,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement,
    onSelectionChange: (row: HTMLElement | null) => void // <--- ДОБАВИТЬ ЭТОТ ПАРАМЕТР
): void {
    const canvasRect = canvasView.getBoundingClientRect();
    const clickY = e.clientY - canvasRect.top;

    const absoluteClickY = clickY + scrollY;
    let currentY = 0;
    let clickedRowIndex = -1;

    for (let i = 0; i < model.rows.length; i++) {
        const rowHeight = model.rows[i].height;
        if (absoluteClickY >= currentY && absoluteClickY < currentY + rowHeight) {
            clickedRowIndex = i;
            break;
        }
        currentY += rowHeight;
    }

    if (clickedRowIndex >= 0) {
        const allRows = document.querySelectorAll('#osc-grid-body .osc-data-row');
        if (allRows[clickedRowIndex]) {
            const rowDiv = allRows[clickedRowIndex] as HTMLElement;

            allRows.forEach((row: Element) => {
                const el = row as HTMLElement;
                el.classList.remove('selected');
            });

            rowDiv.classList.add('selected');
            selectedRowRef.current = rowDiv;
            
            // Вызываем колбэк, чтобы обновить this.selectedRow в классе
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
            const el = row as HTMLElement;
            el.classList.remove('selected');
        });
        
        selectedRowRef.current = null;
        onSelectionChange(null);
        highlighter.style.display = 'none';
    }
}