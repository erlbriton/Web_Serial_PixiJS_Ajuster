import { populateDeviceForm } from './ui.js';
import { currentDeviceConfig, deviceRegistry, addDeviceToRegistry, parseRegisterAddress, hexToFloat32, float32ToHex } from './ini-manager/tree-core.js';
import { clearAnyActiveCellEditors, initHexCellEditor, initPhysicalCellEditor } from './ini-manager/table-editor.js';
import { updateRowValues } from './ini-manager/tree-ui.js';

export function renderModbusTable(config) {
    const tableBody = document.getElementById('grid-data-rows');
    if (!tableBody) return;

    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    const selectedMode = modeSelect && modeSelect.value ? modeSelect.value : 'FLASH';

    tableBody.innerHTML = ''; 

    if (!config || !config[selectedMode]) {
        return;
    }

    const sectionData = config[selectedMode];
    const keys = Object.keys(sectionData);

    for (let i = 0; i < keys.length; i++) {
        try {
            const key = keys[i];
            const parts = sectionData[key];
            
            const isArray = Array.isArray(parts);
            const name = isArray ? (parts[0] || '') : '';
            const description = isArray ? (parts[1] || '') : '';
            const dataType = isArray ? (parts[2] || '') : '';
            
            // Учитываем смещение индексов в INI-файле для дискретных параметров TBit
            const regAddrString = isArray ? (dataType === 'TBit' ? (parts[5] || '') : (parts[4] || '')) : '';
            const units = isArray ? (dataType === 'TBit' ? '—' : (parts[5] || '—')) : '—';

            const parsedAddr = parseRegisterAddress(regAddrString);
            const scale = isArray ? parseFloat(parts[6] ? parts[6].replace(',', '.') : NaN) : NaN;

            let hexIndex = -1;
            if (isArray) {
                if (dataType === 'TBit') {
                    hexIndex = parts.length - 1;
                } else {
                    for (let j = parts.length - 1; j >= 3; j--) {
                        const part = parts[j] ? parts[j].trim() : '';
                        if (!part.includes('#') && part.startsWith('x')) {
                            hexIndex = j;
                            break;
                        }
                    }
                }
            }

            let originalHexLen = 4;
            if (hexIndex !== -1 && isArray && parts[hexIndex].startsWith('x')) {
                originalHexLen = parts[hexIndex].slice(1).length;
            }

            let prmListOptions = {}; 
            if (isArray) {
                for (let j = parts.length - 1; j >= 3; j--) {
                    const part = parts[j] ? parts[j].trim() : '';
                    if (part.includes('#')) {
                        const [h, t] = part.split('#');
                        if (h && t) {
                            prmListOptions[h.toLowerCase()] = t;
                        }
                    }
                }
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-type', dataType);
            tr.setAttribute('data-section', selectedMode); // НОВАЯ СТРОКА
            tr.setAttribute('data-key', key);              // НОВАЯ СТРОКА
            if (parsedAddr.reg !== null) {
                tr.setAttribute('data-reg', parsedAddr.reg.toString(16));
                if (parsedAddr.sub) {
                    tr.setAttribute('data-sub', parsedAddr.sub);
                }
            }

            tr.setAttribute('data-hex-index', hexIndex);
            tr.innerHTML = `
                <td>${key}</td>
                <td class="param-name" title="${name}">${name}</td>
                <td class="param-desc" title="${description}">${description}</td>
                <td>—</td>
                <td class="hex-val">—</td>
                <td>—</td>
                <td class="hex-val">—</td>
                <td>—</td>
            `;

            const unitsDisplay = (dataType === 'TBit') ? '.' : (units === '*' ? '—' : units);
            tr.querySelectorAll('td')[3].textContent = unitsDisplay;

            if (isArray) {
                updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, hexToFloat32, float32ToHex);

                const tds = tr.querySelectorAll('td');
                initHexCellEditor(tds[4], tr, parts, hexIndex, updateRowValues, dataType, scale, originalHexLen, prmListOptions);
                initPhysicalCellEditor(tds[5], tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, updateRowValues, hexToFloat32, float32ToHex);
            }

            tr.addEventListener('click', () => {
                clearAnyActiveCellEditors();
                const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
                if (prevSelected && prevSelected !== tr) {
                    prevSelected.classList.remove('is-selected');
                }
                tr.classList.add('is-selected');
            });

            tableBody.appendChild(tr);
        } catch (e) {
            console.error("Ошибка при отрисовке строки:", keys[i], e);
        }
    }

    if (typeof window.initTableResizers === 'function') {
        window.initTableResizers();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            clearAnyActiveCellEditors();
            if (currentDeviceConfig) renderModbusTable(currentDeviceConfig);
        });
    }
    
    document.addEventListener('click', () => {
        clearAnyActiveCellEditors();
    });
});