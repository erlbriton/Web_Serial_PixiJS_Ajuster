// js/tree.ts
import { currentDeviceConfig, parseRegisterAddress, hexToFloat32, float32ToHex } from './ini-manager/tree-core';
import { clearAnyActiveCellEditors, initHexCellEditor, initPhysicalCellEditor } from './ini-manager/table-editor';
import { updateRowValues } from './ini-manager/tree-ui';

export function renderModbusTable(config: Record<string, Record<string, string[]>>): void {
    const tableBody = document.getElementById('grid-data-rows') as HTMLTableSectionElement | null;
    if (!tableBody) return;

    const modeSelect = document.querySelector('.toolbar-device-mode-select') as HTMLSelectElement | null;
    const selectedMode = modeSelect?.value || 'FLASH';

    tableBody.innerHTML = ''; 

    if (!config || !config[selectedMode]) return;

    const sectionData = config[selectedMode];
    const keys = Object.keys(sectionData);

    // Используем цикл с индексом i для связывания строк с буфером осциллографа и выводом данных
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        try {
            const parts = sectionData[key];
            const name = parts[0] || '';
            const description = parts[1] || '';
            const dataType = parts[2] || '';
            
            const regAddrString = (dataType === 'TBit' ? (parts[5] || '') : (parts[4] || ''));
            const units = (dataType === 'TBit' ? '—' : (parts[5] || '—'));

            const parsedAddr = parseRegisterAddress(regAddrString);
            const scale = parseFloat(parts[6]?.replace(',', '.') || 'NaN');

            let hexIndex = -1;
            if (dataType === 'TBit') {
                hexIndex = parts.length - 1;
            } else {
                for (let j = parts.length - 1; j >= 3; j--) {
                    if (!parts[j].includes('#') && parts[j].startsWith('x')) {
                        hexIndex = j;
                        break;
                    }
                }
            }

            let originalHexLen = 4;
            if (hexIndex !== -1 && parts[hexIndex].startsWith('x')) {
                originalHexLen = parts[hexIndex].slice(1).length;
            }

            const prmListOptions: Record<string, string> = {};
            for (let j = parts.length - 1; j >= 3; j--) {
                const part = parts[j]?.trim() || '';
                if (part.includes('#')) {
                    const [h, t] = part.split('#');
                    if (h && t) prmListOptions[h.toLowerCase()] = t;
                }
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-type', dataType);
            tr.setAttribute('data-section', selectedMode);
            tr.setAttribute('data-key', key);
            if (parsedAddr.reg !== null) {
                tr.setAttribute('data-reg', parsedAddr.reg.toString(16));
                if (parsedAddr.sub) tr.setAttribute('data-sub', parsedAddr.sub);
            }

            tr.setAttribute('data-hex-index', hexIndex.toString());
            
            // Внедряем id="param-..." для динамического обновления данных в реальном времени
            tr.innerHTML = `
                <td>${key}</td>
                <td id="param-name-${i}" class="param-name" title="${name}">${name}</td>
                <td class="param-desc" title="${description}">${description}</td>
                <td id="param-unit-${i}">—</td>
                <td class="hex-val">—</td>
                <td>—</td>
                <td id="param-hex-${i}" class="hex-val">—</td>
                <td id="param-phys-${i}">—</td>
            `;

            tr.querySelectorAll('td')[3].textContent = (dataType === 'TBit') ? '.' : (units === '*' ? '—' : units);

            updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, hexToFloat32, float32ToHex);

            const tds = tr.querySelectorAll('td');
            initHexCellEditor(tds[4], tr, parts, hexIndex, updateRowValues, dataType, scale, originalHexLen, prmListOptions);
            initPhysicalCellEditor(tds[5], tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, updateRowValues, hexToFloat32, float32ToHex);

            tr.addEventListener('click', () => {
                clearAnyActiveCellEditors();
                document.querySelector('#grid-data-rows tr.is-selected')?.classList.remove('is-selected');
                tr.classList.add('is-selected');
            });

            tableBody.appendChild(tr);
        } catch (e) {
            console.error("Ошибка при отрисовке строки:", key, e);
        }
    }

    if (typeof (window as any).initTableResizers === 'function') {
        (window as any).initTableResizers();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.querySelector('.toolbar-device-mode-select') as HTMLSelectElement | null;
    modeSelect?.addEventListener('change', () => {
        clearAnyActiveCellEditors();
        if (currentDeviceConfig) renderModbusTable(currentDeviceConfig);
    });
    
    document.addEventListener('click', () => clearAnyActiveCellEditors());
});