// js/oscilloscope/parts_pixiOscilloscope/canvasInteraction.ts
import { MonitorModel } from "../../model/monitorModel.js";

export function handleCanvasClick(
    e: MouseEvent,
    canvasView: HTMLCanvasElement,
    scrollY: number,
    containerRect: DOMRect,
    model: MonitorModel,
    selectedRowRef: { current: HTMLElement | null },
    highlighter: HTMLDivElement
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

            const rowRect = rowDiv.getBoundingClientRect();

            const top = rowRect.top - containerRect.top;
            const rowHeight = rowRect.height;

            highlighter.style.display = 'block';
            highlighter.style.top = `${top}px`;
            highlighter.style.height = `${rowHeight}px`;
        }
    }
}