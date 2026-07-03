// js/ini-manager/table-editor.js

// Функция для закрытия всех открытых в данный момент инпутов редактирования
export function clearAnyActiveCellEditors() {
    document.querySelectorAll('.is-editing-cell').forEach(el => {
        if (typeof el.blurEditor === 'function') {
            el.blurEditor();
        }
    });
}
//--------------------------------------------------------------------------------------------------------------------------------
// export function clearAnyActiveCellEditors() {
//     document.querySelectorAll('.is-editing-cell').forEach(el => {
//         if (typeof el.blurEditor === 'function') {
//             el.blurEditor();
//         }
//     });
// }

// Заготовка для выноса логики HEX-ячеек
export function initHexCellEditor(cell, tr, parts, hexIndex, updateRowValues, dataType, scale, originalHexLen, prmListOptions) {
    cell.addEventListener('click', (e) => {
        // Здесь будет ваш код обработки клика HEX, который сейчас в tree.js
        console.log("HEX редактор инициализирован");
    });
}

// Заготовка для выноса логики Physical-ячеек
export function initPhysicalCellEditor(cell, tr, parts, dataType, scale, hexIndex, originalHexLen, prmListOptions, updateRowValues) {
    cell.addEventListener('click', (e) => {
        // Здесь будет ваш код обработки клика Physical
        console.log("Physical редактор инициализирован");
    });
}