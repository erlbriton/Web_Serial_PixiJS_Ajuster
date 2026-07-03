import { populateDeviceForm } from './ui.js';

export const deviceRegistry = {};
let currentDeviceConfig = null;

// Вспомогательная функция для парсинга адресов с субадресами (.L, .H, .0-15)
function parseRegisterAddress(addrString) {
    if (!addrString || addrString === '*') return { reg: null, sub: null };
    const cleanStr = addrString.toLowerCase().replace('r', '');
    const parts = cleanStr.split('.');
    return {
        reg: parseInt(parts[0], 16),
        sub: parts[1] ? parts[1].toUpperCase() : null
    };
}

export function addDeviceToRegistry(config) {
    if (!config || !config['DEVICE']) return false;
    const dev = config['DEVICE'];
    const location = dev['Location'] || 'Неизвестное место';
    const id = dev['ID'] || dev['Id'] || dev['id'] || 'Без ID';
    const version = dev['Version'] || ''; 
    const date = dev['Date'] || '';
    const displayComponents = [id, version, date].filter(Boolean);
    const deviceDisplayText = displayComponents.join(' ');

    if (!deviceRegistry[location]) deviceRegistry[location] = [];
    const isDuplicate = deviceRegistry[location].some(item => item.id === id);
    if (!isDuplicate) {
        deviceRegistry[location].push({ id: id, displayText: deviceDisplayText, fullConfig: config });
        return true; 
    }
    return false; 
}

export function renderModbusTable(fullConfig) {
    const tableBody = document.getElementById('grid-data-rows');
    if (!tableBody) return;

    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    const selectedMode = modeSelect ? modeSelect.value : 'FLASH';

    tableBody.innerHTML = ''; 

    if (!fullConfig || !fullConfig[selectedMode]) return;

    const sectionData = fullConfig[selectedMode];

    for (const key in sectionData) {
        const parts = sectionData[key];
        
        if (!Array.isArray(parts) || parts.length < 3) continue;

        const name = parts[0] || '';
        const description = parts[1] || '';
        const dataType = parts[2] || '';
        const regAddrString = parts[4] || '';
        const units = parts[5] || '—';

        const parsedAddr = parseRegisterAddress(regAddrString);

        let baseHex = '—', basePhysical = '—';
        let prmListOptions = {}; 

        if (dataType === 'TBit') {
            const bitValue = parts[parts.length - 1] ? parts[parts.length - 1].trim() : '0';
            basePhysical = (bitValue === '1' || bitValue === '0') ? bitValue : '0';
            baseHex = basePhysical;
        } else {
            let rawHex = '';
            
            for (let i = parts.length - 1; i >= 3; i--) {
                const part = parts[i] ? parts[i].trim() : '';
                
                if (part.includes('#')) {
                    const [h, t] = part.split('#');
                    if (h && t) {
                        prmListOptions[h.toLowerCase()] = t;
                    }
                } else if (!rawHex && part.startsWith('x')) {
                    rawHex = part; 
                }
            }

            if (rawHex && rawHex.startsWith('x')) {
                baseHex = '0x' + rawHex.slice(1).toUpperCase();
                const decValue = parseInt(rawHex.slice(1), 16);
                
                if (dataType === 'TPrmList') {
                    if (Object.keys(prmListOptions).length > 0) {
                        const currentText = prmListOptions[rawHex.toLowerCase()] || decValue.toString();
                        
                        // Создаем и текстовый блок, и скрытый выпадающий список
                        let selectHtml = `<div class="prm-val-display">${currentText}</div>`;
                        selectHtml += `<select class="table-prm-select" style="display: none; width: 100%; box-sizing: border-box;">`;
                        for (const hexKey in prmListOptions) {
                            const textVal = prmListOptions[hexKey];
                            const isSelected = (hexKey === rawHex.toLowerCase()) ? 'selected' : '';
                            selectHtml += `<option value="${hexKey}" ${isSelected}>${textVal}</option>`;
                        }
                        selectHtml += '</select>';
                        
                        basePhysical = selectHtml; 
                    } else {
                        basePhysical = `<div class="prm-val-display">${decValue.toString()}</div>`;
                    }
                } else {
                    const scale = parseFloat(parts[6]);
                    if (!isNaN(decValue) && !isNaN(scale)) {
                        basePhysical = `<div class="prm-val-display">${Number((decValue * scale).toFixed(4)).toString()}</div>`;
                    } else if (!isNaN(decValue)) {
                        basePhysical = `<div class="prm-val-display">${decValue.toString()}</div>`;
                    }
                }
            }
        }

        const unitsDisplay = (dataType === 'TBit') ? '.' : (units === '*' ? '—' : units);

        const tr = document.createElement('tr');
        
        tr.setAttribute('data-type', dataType);
        if (parsedAddr.reg !== null) {
            tr.setAttribute('data-reg', parsedAddr.reg.toString(16));
            if (parsedAddr.sub) {
                tr.setAttribute('data-sub', parsedAddr.sub);
            }
        }

        tr.innerHTML = `
            <td>${key}</td>
            <td class="param-name" title="${name}">${name}</td>
            <td class="param-desc" title="${description}">${description}</td>
            <td>${unitsDisplay}</td>
            <td class="hex-val">${baseHex}</td>
            <td>${basePhysical}</td>
            <td class="hex-val">—</td>
            <td>—</td>
        `;

        // Обработчик изменения значения в списке
        const selectEl = tr.querySelector('.table-prm-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                const selectedHex = e.target.value; 
                const selectedText = e.target.options[e.target.selectedIndex].text;
                
                // Обновляем текстовый блок новым значением
                const displayEl = tr.querySelector('.prm-val-display');
                if (displayEl) {
                    displayEl.textContent = selectedText;
                }
                
                // Обновляем колонку HEX
                const hexTd = tr.querySelectorAll('td')[4];
                if (hexTd) {
                    hexTd.textContent = '0x' + selectedHex.slice(1).toUpperCase();
                }
            });
        }

        // Обработчик клика по строке: скрывает список в предыдущей строке и показывает в текущей
        tr.addEventListener('click', () => {
            const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
            if (prevSelected && prevSelected !== tr) {
                prevSelected.classList.remove('is-selected');
                const prevDisplay = prevSelected.querySelector('.prm-val-display');
                const prevSelect = prevSelected.querySelector('.table-prm-select');
                if (prevDisplay && prevSelect) {
                    prevDisplay.style.display = '';
                    prevSelect.style.display = 'none';
                }
            }

            tr.classList.add('is-selected');
            const currDisplay = tr.querySelector('.prm-val-display');
            const currSelect = tr.querySelector('.table-prm-select');
            if (currDisplay && currSelect) {
                currDisplay.style.display = 'none';
                currSelect.style.display = '';
            }
        });

        tableBody.appendChild(tr);
    }

    if (typeof window.initTableResizers === 'function') {
        window.initTableResizers();
    } else if (typeof initTableResizers === 'function') {
        initTableResizers();
    }
}

export function renderDeviceTree() {
    const container = document.querySelector('.sidebar-tree-container');
    if (!container) return;
    container.innerHTML = ''; 
    for (const location in deviceRegistry) {
        const detailsElement = document.createElement('details');
        detailsElement.className = 'tree-location';
        detailsElement.open = true; 
        const summaryElement = document.createElement('summary');
        summaryElement.className = 'tree-location-title';
        summaryElement.textContent = location;
        const ulElement = document.createElement('ul');
        ulElement.className = 'tree-id-list';
        deviceRegistry[location].forEach(device => {
            const liElement = document.createElement('li');
            liElement.className = 'tree-id-item is-leaf'; 
            liElement.textContent = device.displayText;
            liElement.addEventListener('click', () => {
                document.querySelectorAll('.tree-id-item.is-selected').forEach(el => el.classList.remove('is-selected'));
                liElement.classList.add('is-selected');
                currentDeviceConfig = device.fullConfig;
                populateDeviceForm(device.fullConfig['DEVICE']);
                renderModbusTable(currentDeviceConfig);
            });
            ulElement.appendChild(liElement);
        });
        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(ulElement);
        container.appendChild(detailsElement);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            if (currentDeviceConfig) renderModbusTable(currentDeviceConfig);
        });
    }
});