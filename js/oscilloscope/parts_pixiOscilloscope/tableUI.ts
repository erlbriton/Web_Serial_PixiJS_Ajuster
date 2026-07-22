// js/oscilloscope/parts_pixiOscilloscope/tableUI.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { openSignalConfigDialog } from "./signalConfigDialog.js";

export function generateTableRows(
    model: MonitorModel,
    bodyContainer: HTMLElement,
    containerElement: HTMLElement,
    highlighter: HTMLDivElement,
    onRowClick: (rowDiv: HTMLElement) => void,
    onSaveConfig?: () => void
): void {
    bodyContainer.innerHTML = '';

    // Блокируем стандартное контекстное меню для всей области таблицы
    bodyContainer.oncontextmenu = (e: MouseEvent) => e.preventDefault();

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

        // Левый клик — выделение строки
        rowDiv.addEventListener('click', () => {
            onRowClick(rowDiv);

            const rowRect = rowDiv.getBoundingClientRect();
            const containerRect = containerElement.getBoundingClientRect();
            
            const top = rowRect.top - containerRect.top;
            const height = rowRect.height;
            
            highlighter.style.display = 'block';
            highlighter.style.top = `${top}px`;
            highlighter.style.height = `${height}px`;
        });

        // Правый клик — гарантированное открытие окна настройки
        rowDiv.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            onRowClick(rowDiv);
            const rowRect = rowDiv.getBoundingClientRect();
            const containerRect = containerElement.getBoundingClientRect();
            
            highlighter.style.display = 'block';
            highlighter.style.top = `${rowRect.top - containerRect.top}px`;
            highlighter.style.height = `${rowRect.height}px`;

            openSignalConfigDialog(row, () => {
                if (onSaveConfig) onSaveConfig();
            });
        });

        bodyContainer.appendChild(rowDiv);
    });
}