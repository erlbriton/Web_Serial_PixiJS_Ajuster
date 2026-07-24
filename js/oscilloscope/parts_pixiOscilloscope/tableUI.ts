// js/oscilloscope/parts_pixiOscilloscope/tableUI.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { openSignalConfigDialog } from "./signalConfigDialog.js";
import { openRowContextMenu } from "./openMenu.js";

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
        rowDiv.style.height = `${row.height || 20}px`;

        // Если строка помечена как невидимая — скрываем её через CSS
        if (row.visible === false) {
            rowDiv.style.display = 'none';
        }

        const signal = row.signal || {};
        const isTBit = String(signal.dataType || '').trim() === 'TBit';

        const regVal = signal.register;
        const hexVal = isTBit || regVal === undefined || regVal === null
            ? ''
            : '0x' + Number(regVal).toString(16).toUpperCase().padStart(4, '0');

        const curVal = signal.currentValue;
        const multiplier = typeof signal.multiplier === 'number' ? signal.multiplier : 1;

        // Вычисляем физическое значение с учётом множителя (шкалы)
        const physVal = isTBit
            ? ''
            : (typeof curVal === 'number' 
                ? (curVal * multiplier).toFixed(2) 
                : String(curVal ?? '0.00'));

        const indicatorHtml = isTBit
            ? `<div id="osc-ind-${i}" class="discrete-indicator">${curVal === 1 ? 'I' : '0'}</div>`
            : '';

        rowDiv.innerHTML = `
            <div class="col col-name" title="${signal.name || ''}">${signal.name || ''}</div>
            <div class="col col-hex" id="osc-hex-${i}">${isTBit ? indicatorHtml : hexVal}</div>
            <div class="col col-phys" id="osc-phys-${i}">${physVal}</div>
            <div class="col col-unit">${isTBit ? '' : (signal.unit || '')}</div>
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

        // ПРАВЫЙ КЛИК — Вызов контекстного меню
        rowDiv.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            onRowClick(rowDiv);
            const rowRect = rowDiv.getBoundingClientRect();
            const containerRect = containerElement.getBoundingClientRect();
            
            highlighter.style.display = 'block';
            highlighter.style.top = `${rowRect.top - containerRect.top}px`;
            highlighter.style.height = `${rowRect.height}px`;

            openRowContextMenu({
                x: e.clientX,
                y: e.clientY,
                onProperties: () => {
                    openSignalConfigDialog(row, () => {
                        if (onSaveConfig) onSaveConfig();
                    });
                },
                onDelete: () => {
                    row.visible = false;
                    highlighter.style.display = 'none';
                    if (onSaveConfig) onSaveConfig();
                }
            });
        });

        bodyContainer.appendChild(rowDiv);
    });
}