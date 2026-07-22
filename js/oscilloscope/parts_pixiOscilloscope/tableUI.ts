// js/oscilloscope/parts_pixiOscilloscope/tableUI.ts
import { MonitorModel } from "../../model/monitorModel.js";

export function generateTableRows(
    model: MonitorModel,
    bodyContainer: HTMLElement,
    containerElement: HTMLElement, // <-- Передаем элемент, а не готовый rect
    highlighter: HTMLDivElement,
    onRowClick: (rowDiv: HTMLElement) => void
): void {
    bodyContainer.innerHTML = '';

    model.rows.forEach((row: any, i: number) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'osc-data-row';
        rowDiv.style.height = `${row.height}px`;

        const isTBit = String(row.signal.dataType || '').trim() === 'TBit';

        const hexVal = isTBit
            ? ''
            : row.signal.register.toString(16).toUpperCase().padStart(4, '0');

        const physVal = isTBit
            ? ''
            : (typeof row.signal.currentValue === 'number' ? row.signal.currentValue.toFixed(2) : String(row.signal.currentValue));

        const indicatorHtml = isTBit
            ? `<div id="osc-ind-${i}" class="discrete-indicator">${row.signal.currentValue === 1 ? 'I' : 'O'}</div>`
            : '';

        rowDiv.innerHTML = `
            <div class="col col-name" title="${row.signal.name}">${row.signal.name}</div>
            <div class="col col-hex" id="osc-hex-${i}">${isTBit ? indicatorHtml : hexVal}</div>
            <div class="col col-phys" id="osc-phys-${i}">${physVal}</div>
            <div class="col col-unit">${isTBit ? '' : row.signal.unit}</div>
            <div class="col col-graph"></div>
        `;

        rowDiv.addEventListener('click', () => {
            onRowClick(rowDiv);

            // ВАЖНО: Вычисляем координаты прямо здесь, в момент клика (как в оригинале)
            const rowRect = rowDiv.getBoundingClientRect();
            const containerRect = containerElement.getBoundingClientRect();
            
            const top = rowRect.top - containerRect.top;
            const height = rowRect.height;
            
            highlighter.style.display = 'block';
            highlighter.style.top = `${top}px`;
            highlighter.style.height = `${height}px`;
        });

        bodyContainer.appendChild(rowDiv);
    });
}