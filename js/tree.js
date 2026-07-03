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

// Вспомогательная функция для преобразования HEX-строки в 32-битный Float (IEEE 754)
function hexToFloat32(hexStr) {
    if (!hexStr) return NaN;
    const intVal = parseInt(hexStr, 16);
    if (isNaN(intVal)) return NaN;
    
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, intVal, false); // false указывает на Big-Endian
    return view.getFloat32(0, false);
}

// Вспомогательная функция для преобразования 32-битного Float обратно в HEX-строку (IEEE 754)
function float32ToHex(floatVal, padLen = 8) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, floatVal, false); // false указывает на Big-Endian
    const intVal = view.getUint32(0, false);
    return 'x' + intVal.toString(16).toUpperCase().padStart(padLen, '0');
}

// Функция для закрытия всех открытых в данный момент инпутов редактирования
function clearAnyActiveCellEditors() {
    document.querySelectorAll('.is-editing-cell').forEach(el => {
        if (typeof el.blurEditor === 'function') {
            el.blurEditor();
        }
    });
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

    // Внутренняя функция для синхронного обновления текста и элементов внутри HTML-ячеек строки
    function updateRowValues(rowElement, rowParts, rowDataType, rowScale, rowHexIndex, rowOriginalHexLen, rowPrmListOptions) {
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

    for (const key in sectionData) {
        const parts = sectionData[key];
        
        if (!Array.isArray(parts) || parts.length < 3) continue;

        const name = parts[0] || '';
        const description = parts[1] || '';
        const dataType = parts[2] || '';
        const regAddrString = parts[4] || '';
        const units = parts[5] || '—';

        const parsedAddr = parseRegisterAddress(regAddrString);
        const scale = parseFloat(parts[6] ? parts[6].replace(',', '.') : NaN);

        // Поиск индекса HEX-значения внутри массива параметров строки
        let hexIndex = -1;
        if (dataType === 'TBit') {
            hexIndex = parts.length - 1;
        } else {
            for (let i = parts.length - 1; i >= 3; i--) {
                const part = parts[i] ? parts[i].trim() : '';
                if (!part.includes('#') && part.startsWith('x')) {
                    hexIndex = i;
                    break;
                }
            }
        }

        // Сохраняем изначальную длину hex-строки для корректного обратного дополнения нулями
        let originalHexLen = 4;
        if (hexIndex !== -1 && parts[hexIndex].startsWith('x')) {
            originalHexLen = parts[hexIndex].slice(1).length;
        }

        let prmListOptions = {}; 
        for (let i = parts.length - 1; i >= 3; i--) {
            const part = parts[i] ? parts[i].trim() : '';
            if (part.includes('#')) {
                const [h, t] = part.split('#');
                if (h && t) {
                    prmListOptions[h.toLowerCase()] = t;
                }
            }
        }

        const tr = document.createElement('tr');
        tr.setAttribute('data-type', dataType);
        if (parsedAddr.reg !== null) {
            tr.setAttribute('data-reg', parsedAddr.reg.toString(16));
            if (parsedAddr.sub) {
                tr.setAttribute('data-sub', parsedAddr.sub);
            }
        }

        // Первичный вывод значений в созданную строку
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

        updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);

        const tds = tr.querySelectorAll('td');
        const cellHex = tds[4];
        const cellPhysical = tds[5];

        // --- Обработчик интерактивного редактирования ячейки HEX ---
        cellHex.addEventListener('click', (e) => {
            if (cellHex.classList.contains('is-editing-cell')) {
                // ВТОРОЙ КЛИК: активируем поле для ввода и возвращаем курсор
                const inputEl = cellHex.querySelector('input');
                if (inputEl && inputEl.readOnly) {
                    inputEl.readOnly = false;
                    inputEl.style.caretColor = ''; // Восстанавливаем видимость курсора
                    inputEl.focus();
                }
                e.stopPropagation();
                return;
            }

            clearAnyActiveCellEditors();

            // Подсвечиваем всю строку зеленым цветом
            const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
            if (prevSelected && prevSelected !== tr) {
                prevSelected.classList.remove('is-selected');
            }
            tr.classList.add('is-selected');

            // Подсвечиваем саму ячейку полностью желтым цветом
            cellHex.style.backgroundColor = 'yellow';
            
            // Сохраняем исходный padding, чтобы вернуть его при закрытии
            cellHex.dataset.oldPadding = cellHex.style.padding;
            cellHex.style.padding = '0'; 
            cellHex.classList.add('is-editing-cell');

            let currentRawHex = parts[hexIndex] || (cellHex.textContent.startsWith('0x') ? 'x' + cellHex.textContent.slice(2) : 'x0000');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentRawHex;
            
            // ПЕРВЫЙ КЛИК: Только подготовка (инпут защищен от ввода, курсор скрыт)
            input.readOnly = true; 
            
            input.style.width = '100%';
            input.style.height = '100%';
            input.style.boxSizing = 'border-box';
            input.style.backgroundColor = 'yellow';
            input.style.border = 'none';
            input.style.outline = 'none';
            input.style.font = 'inherit';
            input.style.color = 'inherit';
            input.style.padding = cellHex.dataset.oldPadding || '0px 4px';
            input.style.margin = '0';
            input.style.textAlign = 'center';      
            input.style.caretColor = 'transparent'; 

            cellHex.innerHTML = '';
            cellHex.appendChild(input);

            const saveHex = () => {
                if (input.readOnly) {
                    // Если пользователь так и не зашел в режим редактирования, просто убираем желтый фон
                    cellHex.style.padding = cellHex.dataset.oldPadding || '';
                    updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                    cellHex.style.backgroundColor = '';
                    cellHex.classList.remove('is-editing-cell');
                    delete cellHex.blurEditor;
                    return;
                }

                let newVal = input.value.trim();
                if (!newVal) newVal = currentRawHex;

                if (newVal.toLowerCase().startsWith('0x')) {
                    newVal = 'x' + newVal.slice(2);
                } else if (!newVal.toLowerCase().startsWith('x')) {
                    newVal = 'x' + newVal;
                }

                parts[hexIndex] = newVal;
                
                cellHex.style.padding = cellHex.dataset.oldPadding || '';
                updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);

                cellHex.style.backgroundColor = '';
                cellHex.classList.remove('is-editing-cell');
                delete cellHex.blurEditor;
            };

            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    saveHex();
                } else if (evt.key === 'Escape') {
                    cellHex.style.padding = cellHex.dataset.oldPadding || '';
                    updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                    cellHex.style.backgroundColor = '';
                    cellHex.classList.remove('is-editing-cell');
                    delete cellHex.blurEditor;
                }
            });

            input.addEventListener('blur', saveHex);
            cellHex.blurEditor = saveHex;
            e.stopPropagation();
        });

        // --- Обработчик интерактивного редактирования ячейки Physical ---
        cellPhysical.addEventListener('click', (e) => {
            if (cellPhysical.classList.contains('is-editing-cell')) {
                // ВТОРОЙ КЛИК: активируем поле для ввода / выпадающий список
                if (dataType === 'TPrmList') {
                    const selectEl = cellPhysical.querySelector('.table-prm-select');
                    if (selectEl && selectEl.style.display === 'none') {
                        const displayEl = cellPhysical.querySelector('.prm-val-display');
                        if (displayEl) displayEl.style.display = 'none';
                        selectEl.style.display = '';
                        selectEl.focus();
                    }
                } else {
                    const inputEl = cellPhysical.querySelector('input');
                    if (inputEl && inputEl.readOnly) {
                        inputEl.readOnly = false;
                        inputEl.style.caretColor = ''; 
                        inputEl.focus();
                    }
                }
                e.stopPropagation();
                return;
            }

            clearAnyActiveCellEditors();

            // Подсвечиваем всю строку зеленым цветом
            const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
            if (prevSelected && prevSelected !== tr) {
                prevSelected.classList.remove('is-selected');
            }
            tr.classList.add('is-selected');

            // Подсвечиваем ячейку полностью желтым цветом
            cellPhysical.style.backgroundColor = 'yellow';
            
            cellPhysical.dataset.oldPadding = cellPhysical.style.padding;
            cellPhysical.style.padding = '0'; 
            cellPhysical.classList.add('is-editing-cell');

            if (dataType === 'TPrmList') {
                const displayEl = cellPhysical.querySelector('.prm-val-display');
                const selectEl = cellPhysical.querySelector('.table-prm-select');
                if (displayEl && selectEl) {
                    // ПЕРВЫЙ КЛИК для списка: Оставляем отображение текста, селект пока прячем
                    selectEl.style.width = '100%';
                    selectEl.style.height = '100%';
                    selectEl.style.boxSizing = 'border-box';
                    selectEl.style.backgroundColor = 'yellow';
                    selectEl.style.border = 'none';
                    selectEl.style.outline = 'none';
                    selectEl.style.font = 'inherit';
                    selectEl.style.color = 'inherit';
                    selectEl.style.padding = cellPhysical.dataset.oldPadding || '0px 4px';
                    selectEl.style.textAlign = 'center';
                    selectEl.style.textAlignLast = 'center'; 

                    const savePrmList = () => {
                        cellPhysical.style.padding = cellPhysical.dataset.oldPadding || '';
                        cellPhysical.style.backgroundColor = '';
                        cellPhysical.classList.remove('is-editing-cell');
                        displayEl.style.display = '';
                        selectEl.style.display = 'none';
                        delete cellPhysical.blurEditor;
                    };

                    selectEl.onblur = savePrmList;
                    cellPhysical.blurEditor = savePrmList;
                }
            } else {
                const displayEl = cellPhysical.querySelector('.prm-val-display');
                let currentText = displayEl ? displayEl.textContent.trim() : cellPhysical.textContent.trim();
                if (currentText === '—') currentText = '0';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                
                // ПЕРВЫЙ КЛИК для текста: Только подготовка, защищено от ввода
                input.readOnly = true;

                input.style.width = '100%';
                input.style.height = '100%';
                input.style.boxSizing = 'border-box';
                input.style.backgroundColor = 'yellow';
                input.style.border = 'none';
                input.style.outline = 'none';
                input.style.font = 'inherit';
                input.style.color = 'inherit';
                input.style.padding = cellPhysical.dataset.oldPadding || '0px 4px';
                input.style.margin = '0';
                input.style.textAlign = 'center';      
                input.style.caretColor = 'transparent'; 

                cellPhysical.innerHTML = '';
                cellPhysical.appendChild(input);

                const savePhysical = () => {
                    if (input.readOnly) {
                        cellPhysical.style.padding = cellPhysical.dataset.oldPadding || '';
                        updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                        cellPhysical.style.backgroundColor = '';
                        cellPhysical.classList.remove('is-editing-cell');
                        delete cellPhysical.blurEditor;
                        return;
                    }

                    let newValStr = input.value.trim().replace(',', '.');
                    if (!newValStr) newValStr = '0';

                    let newHex = 'x0000';

                    if (dataType === 'TBit') {
                        const bitVal = (newValStr === '1' || newValStr.toLowerCase() === 'true') ? '1' : '0';
                        parts[hexIndex] = bitVal;
                    } else if (dataType === 'TFloat') {
                        const floatVal = parseFloat(newValStr);
                        const unscaledFloat = !isNaN(scale) && scale !== 0 ? floatVal / scale : floatVal;
                        newHex = float32ToHex(isNaN(unscaledFloat) ? 0 : unscaledFloat, originalHexLen);
                        parts[hexIndex] = newHex;
                    } else {
                        const physVal = parseFloat(newValStr);
                        const unscaledInt = !isNaN(scale) && scale !== 0 ? Math.round(physVal / scale) : Math.round(physVal);
                        let val = isNaN(unscaledInt) ? 0 : unscaledInt;
                        if (val < 0) {
                            val = (val & 0xFFFF); 
                        }
                        newHex = 'x' + val.toString(16).toUpperCase().padStart(originalHexLen, '0');
                        parts[hexIndex] = newHex;
                    }

                    cellPhysical.style.padding = cellPhysical.dataset.oldPadding || '';
                    updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);

                    cellPhysical.style.backgroundColor = '';
                    cellPhysical.classList.remove('is-editing-cell');
                    delete cellPhysical.blurEditor;
                };

                input.addEventListener('keydown', (evt) => {
                    if (evt.key === 'Enter') {
                        savePhysical();
                    } else if (evt.key === 'Escape') {
                        cellPhysical.style.padding = cellPhysical.dataset.oldPadding || '';
                        updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                        cellPhysical.style.backgroundColor = '';
                        cellPhysical.classList.remove('is-editing-cell');
                        delete cellPhysical.blurEditor;
                    }
                });

                input.addEventListener('blur', savePhysical);
                cellPhysical.blurEditor = savePhysical;
            }
            e.stopPropagation();
        });

        // Обработчик клика по строке для зеленой подсветки (при клике на имя, описание параметры и т.д.)
        tr.addEventListener('click', () => {
            clearAnyActiveCellEditors();
            const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
            if (prevSelected && prevSelected !== tr) {
                prevSelected.classList.remove('is-selected');
            }
            tr.classList.add('is-selected');
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
                clearAnyActiveCellEditors();
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
            clearAnyActiveCellEditors();
            if (currentDeviceConfig) renderModbusTable(currentDeviceConfig);
        });
    }
    
    // Закрываем инпуты редактирования при клике в любое свободное место документа
    document.addEventListener('click', () => {
        clearAnyActiveCellEditors();
    });
});