import { calculateNewHex } from './table-saver.js';

export function clearAnyActiveCellEditors() {
    document.querySelectorAll('.is-editing-cell').forEach(el => {
        if (typeof el.blurEditor === 'function') el.blurEditor();
    });
}

export function initHexCellEditor(cellHex, tr, parts, hexIndex, updateRowValues, dataType, scale, originalHexLen, prmListOptions) {
    cellHex.addEventListener('click', (e) => {
        if (cellHex.classList.contains('is-editing-cell')) {
            const inputEl = cellHex.querySelector('input');
            if (inputEl && inputEl.readOnly) {
                inputEl.readOnly = false;
                inputEl.style.caretColor = '';
                inputEl.focus();
            }
            e.stopPropagation();
            return;
        }

        clearAnyActiveCellEditors();

        const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
        if (prevSelected && prevSelected !== tr) prevSelected.classList.remove('is-selected');
        tr.classList.add('is-selected');

        cellHex.style.backgroundColor = 'yellow';
        cellHex.dataset.oldPadding = cellHex.style.padding;
        cellHex.style.padding = '0';
        cellHex.classList.add('is-editing-cell');

        let currentRawHex = parts[hexIndex] || (cellHex.textContent.startsWith('0x') ? 'x' + cellHex.textContent.slice(2) : 'x0000');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentRawHex;
        input.readOnly = true;
        input.style.width = '100%'; input.style.height = '100%'; input.style.boxSizing = 'border-box';
        input.style.backgroundColor = 'yellow'; input.style.border = 'none'; input.style.outline = 'none';
        input.style.font = 'inherit'; input.style.color = 'inherit';
        input.style.padding = cellHex.dataset.oldPadding || '0px 4px';
        input.style.margin = '0'; input.style.textAlign = 'center'; input.style.caretColor = 'transparent';

        cellHex.innerHTML = '';
        cellHex.appendChild(input);

        const saveHex = () => {
            if (input.readOnly) {
                cellHex.style.padding = cellHex.dataset.oldPadding || '';
                updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                cellHex.style.backgroundColor = '';
                cellHex.classList.remove('is-editing-cell');
                delete cellHex.blurEditor;
                return;
            }
            let newVal = input.value.trim();
            if (!newVal) newVal = currentRawHex;
            if (newVal.toLowerCase().startsWith('0x')) newVal = 'x' + newVal.slice(2);
            else if (!newVal.toLowerCase().startsWith('x')) newVal = 'x' + newVal;

            parts[hexIndex] = newVal;
            cellHex.style.padding = cellHex.dataset.oldPadding || '';
            updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
            cellHex.style.backgroundColor = '';
            cellHex.classList.remove('is-editing-cell');
            delete cellHex.blurEditor;
        };

        input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') saveHex();
            else if (evt.key === 'Escape') {
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
}

export function initPhysicalCellEditor(cellPhysical, tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, updateRowValues, hexToFloat32, float32ToHex) {
    cellPhysical.addEventListener('click', (e) => {
        if (cellPhysical.classList.contains('is-editing-cell')) {
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

        const prevSelected = document.querySelector('#grid-data-rows tr.is-selected');
        if (prevSelected && prevSelected !== tr) prevSelected.classList.remove('is-selected');
        tr.classList.add('is-selected');

        cellPhysical.style.backgroundColor = 'yellow';
        cellPhysical.dataset.oldPadding = cellPhysical.style.padding;
        cellPhysical.style.padding = '0';
        cellPhysical.classList.add('is-editing-cell');

        if (dataType === 'TPrmList') {
            const displayEl = cellPhysical.querySelector('.prm-val-display');
            const selectEl = cellPhysical.querySelector('.table-prm-select');
            if (displayEl && selectEl) {
                selectEl.style.width = '100%'; selectEl.style.height = '100%'; selectEl.style.boxSizing = 'border-box';
                selectEl.style.backgroundColor = 'yellow'; selectEl.style.border = 'none'; selectEl.style.outline = 'none';
                selectEl.style.font = 'inherit'; selectEl.style.color = 'inherit';
                selectEl.style.padding = cellPhysical.dataset.oldPadding || '0px 4px';
                selectEl.style.textAlign = 'center'; selectEl.style.textAlignLast = 'center';

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
            input.type = 'text'; input.value = currentText; input.readOnly = true;
            input.style.width = '100%'; input.style.height = '100%'; input.style.boxSizing = 'border-box';
            input.style.backgroundColor = 'yellow'; input.style.border = 'none'; input.style.outline = 'none';
            input.style.font = 'inherit'; input.style.color = 'inherit';
            input.style.padding = cellPhysical.dataset.oldPadding || '0px 4px';
            input.style.margin = '0'; input.style.textAlign = 'center'; input.style.caretColor = 'transparent';

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

                parts[hexIndex] = calculateNewHex(input.value.trim(), dataType, scale, originalHexLen, float32ToHex);

                cellPhysical.style.padding = cellPhysical.dataset.oldPadding || '';
                updateRowValues(tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions);
                cellPhysical.style.backgroundColor = '';
                cellPhysical.classList.remove('is-editing-cell');
                delete cellPhysical.blurEditor;
            };

            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') savePhysical();
                else if (evt.key === 'Escape') {
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
}