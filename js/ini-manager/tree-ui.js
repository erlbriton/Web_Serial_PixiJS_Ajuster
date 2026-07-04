console.log("Модуль tree-ui.js загружен!");
import { populateDeviceForm } from '../ui.js';
import { renderModbusTable } from '../tree.js';
import { deviceRegistry, setCurrentDeviceConfig } from './tree-core.js';

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
                // Здесь мы будем вызывать функции очистки и отрисовки
                document.querySelectorAll('.tree-id-item.is-selected').forEach(el => el.classList.remove('is-selected'));
                liElement.classList.add('is-selected');
                
                setCurrentDeviceConfig(device.fullConfig);
                populateDeviceForm(device.fullConfig['DEVICE']);
                renderModbusTable(device.fullConfig);
            });
            ulElement.appendChild(liElement);
        });
        
        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(ulElement);
        container.appendChild(detailsElement);
    }
}
//Внутренняя функция для синхронного обновления текста и элементов внутри HTML-ячеек строки
export function updateRowValues(rowElement, rowParts, rowDataType, rowScale, rowHexIndex, rowOriginalHexLen, rowPrmListOptions) {
        const rowTds = rowElement.querySelectorAll('td');
        const rCellHex = rowTds[4];
        const rCellPhysical = rowTds[5];
        
        let bHex = '—', bPhysical = '—';
        
        if (rowDataType === 'TBit') {
            const bitValue = rowParts[rowParts.length - 1] ? rowParts[rowParts.length - 1].trim() : '0';
            bPhysical = (bitValue === '1' || bitValue === '0') ? bitValue : '0';
            bHex = bPhysical;
        } else {
            let rHex = '';
            if (rowHexIndex !== -1) {
                rHex = rowParts[rowHexIndex];
            }
            
            if (rHex && rHex.startsWith('x')) {
                bHex = '0x' + rHex.slice(1).toUpperCase();
                
                if (rowDataType === 'TPrmList') {
                    const decValue = parseInt(rHex.slice(1), 16);
                    if (Object.keys(rowPrmListOptions).length > 0) {
                        const currentText = rowPrmListOptions[rHex.toLowerCase()] || decValue.toString();
                        
                        let selectHtml = `<div class="prm-val-display">${currentText}</div>`;
                        selectHtml += `<select class="table-prm-select" style="display: none; width: 100%; height: 100%; box-sizing: border-box; text-align: center; text-align-last: center;">`;
                        for (const hexKey in rowPrmListOptions) {
                            const textVal = rowPrmListOptions[hexKey];
                            const isSelected = (hexKey === rHex.toLowerCase()) ? 'selected' : '';
                            selectHtml += `<option value="${hexKey}" ${isSelected}>${textVal}</option>`;
                        }
                        selectHtml += '</select>';
                        
                        bPhysical = selectHtml; 
                    } else {
                        bPhysical = `<div class="prm-val-display">${decValue.toString()}</div>`;
                    }
                } else if (rowDataType === 'TFloat') {
                    const floatValue = hexToFloat32(rHex.slice(1));
                    if (!isNaN(floatValue)) {
                        const scaledValue = !isNaN(rowScale) ? floatValue * rowScale : floatValue;
                        bPhysical = `<div class="prm-val-display">${Number(scaledValue.toFixed(4)).toString()}</div>`;
                    } else {
                        bPhysical = `<div class="prm-val-display">—</div>`;
                    }
                } else {
                    const decValue = parseInt(rHex.slice(1), 16);
                    if (!isNaN(decValue) && !isNaN(rowScale)) {
                        bPhysical = `<div class="prm-val-display">${Number((decValue * rowScale).toFixed(4)).toString()}</div>`;
                    } else if (!isNaN(decValue)) {
                        bPhysical = `<div class="prm-val-display">${decValue.toString()}</div>`;
                    }
                }
            }
        }
        
        rCellHex.textContent = bHex;
        if (bPhysical.startsWith('<div') || bPhysical.startsWith('<select')) {
            rCellPhysical.innerHTML = bPhysical;
        } else {
            rCellPhysical.innerHTML = `<div class="prm-val-display">${bPhysical}</div>`;
        }
        
        // Перепривязываем обработчик события для выпадающего списка TPrmList
        const newSelectEl = rCellPhysical.querySelector('.table-prm-select');
        if (newSelectEl) {
            newSelectEl.addEventListener('change', (e) => {
                const selectedHex = e.target.value; 
                const selectedText = e.target.options[e.target.selectedIndex].text;
                
                const displayEl = rCellPhysical.querySelector('.prm-val-display');
                if (displayEl) {
                    displayEl.textContent = selectedText;
                }
                
                rCellHex.textContent = '0x' + selectedHex.slice(1).toUpperCase();
                if (rowHexIndex !== -1) {
                    rowParts[rowHexIndex] = selectedHex;
                }
            });
        }
    }