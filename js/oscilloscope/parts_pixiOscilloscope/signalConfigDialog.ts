// js/oscilloscope/parts_pixiOscilloscope/signalConfigDialog.ts
import { MonitorRow } from "../../model/monitorRow.js";

export interface ExtendedMonitorRow extends MonitorRow {
    autoScale?: boolean;
}

export function openSignalConfigDialog(
    rowInput: MonitorRow,
    onSave: () => void
): void {
    const row = rowInput as ExtendedMonitorRow;

    const existing = document.getElementById('osc-signal-config-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'osc-signal-config-dialog';
    dialog.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #2b2b2b; color: #fff; border: 1px solid #555; padding: 16px;
        z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font-family: sans-serif; 
        min-width: 320px; border-radius: 4px;
    `;

    const signal = row.signal;
    const isTBit = String(signal.dataType || '').trim() === 'TBit';
    const disabledAttr = isTBit ? 'disabled' : '';
    const inputStyle = `width:100%; background:${isTBit ? '#111' : '#1a1a1a'}; border:1px solid #444; color:${isTBit ? '#888' : '#fff'}; padding:6px; box-sizing:border-box;`;
    
    const isAuto = row.autoScale !== false;

    // Орачиваем всё в <form>, чтобы штатно обрабатывать Enter
    dialog.innerHTML = `
        <form id="osc-cfg-form" onsubmit="return false;" style="margin:0; padding:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #444; padding-bottom:8px;">
                <strong style="font-size:14px;">Настройка параметра ${isTBit ? '(Только чтение)' : ''}</strong>
                <span id="osc-close-dialog" style="cursor:pointer; color:#aaa; font-size:18px;">✖</span>
            </div>
            
            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:11px; color:#aaa; margin-bottom:4px;">Обозначение:</label>
                <input type="text" id="osc-cfg-name" value="${signal.name}" ${disabledAttr} style="${inputStyle}">
            </div>

            <div style="margin-bottom:10px;">
                <label style="display:block; font-size:11px; color:#aaa; margin-bottom:4px;">Описание:</label>
                <textarea id="osc-cfg-desc" rows="2" ${disabledAttr} style="${inputStyle} resize:none;"></textarea>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:10px; align-items: flex-end;">
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <label style="font-size:11px; color:#aaa;">Максимум:</label>
                        <label style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="checkbox" id="osc-cfg-auto" ${isAuto ? 'checked' : ''} ${disabledAttr}> Авто
                        </label>
                    </div>
                    <input type="number" id="osc-cfg-max" value="${row.maxScale ?? 1}" step="0.1" ${isAuto || isTBit ? 'disabled' : ''} style="${inputStyle}">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-size:11px; color:#aaa; margin-bottom:4px;">Высота (px):</label>
                    <input type="number" id="osc-cfg-height" value="${row.height}" min="10" max="200" ${disabledAttr} style="${inputStyle}">
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <label style="display:block; font-size:11px; color:#aaa; margin-bottom:4px;">Шкала (Множитель):</label>
                <input type="number" id="osc-cfg-scale" value="${signal.multiplier || 1}" step="0.01" ${disabledAttr} style="${inputStyle}">
            </div>

            ${isTBit 
                ? `<button type="button" id="osc-close-btn" style="width:100%; padding:8px; background:#444; color:white; border:none; cursor:pointer; font-weight:bold; border-radius:3px;">Закрыть</button>`
                : `<button type="submit" id="osc-apply-config" style="width:100%; padding:8px; background:#0055ff; color:white; border:none; cursor:pointer; font-weight:bold; border-radius:3px;">Применить</button>`
            }
        </form>
    `;

    // Заполняем textarea через value, чтобы избежать проблем со спецсимволами
    const descTextarea = dialog.querySelector('#osc-cfg-desc') as HTMLTextAreaElement;
    if (descTextarea) {
        descTextarea.value = signal.description || '';
    }

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:999; background:rgba(0,0,0,0.3);';
    document.body.appendChild(backdrop);
    backdrop.appendChild(dialog);

    const closeDialog = () => {
        dialog.remove();
        backdrop.remove();
    };

    const closeBtn = document.getElementById('osc-close-dialog')!;
    closeBtn.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeDialog();
    });

    if (isTBit) {
        const closeBtnBottom = document.getElementById('osc-close-btn');
        if (closeBtnBottom) closeBtnBottom.addEventListener('click', closeDialog);
    } else {
        const autoCheckbox = document.getElementById('osc-cfg-auto') as HTMLInputElement;
        const maxInput = document.getElementById('osc-cfg-max') as HTMLInputElement;
        
        autoCheckbox.addEventListener('change', () => {
            maxInput.disabled = autoCheckbox.checked;
        });

        const form = document.getElementById('osc-cfg-form') as HTMLFormElement;
        const nameInput = document.getElementById('osc-cfg-name') as HTMLInputElement;
        const descInput = document.getElementById('osc-cfg-desc') as HTMLTextAreaElement;
        const heightInput = document.getElementById('osc-cfg-height') as HTMLInputElement;
        const scaleInput = document.getElementById('osc-cfg-scale') as HTMLInputElement;

        // Единая функция сохранения
        const saveAndClose = () => {
            signal.name = nameInput.value;
            signal.description = descInput.value;
            signal.multiplier = parseFloat(scaleInput.value) || 1;
            
            row.height = parseInt(heightInput.value) || 20;
            row.autoScale = autoCheckbox.checked;
            row.maxScale = parseFloat(maxInput.value) || 1; 

            onSave(); 
            closeDialog();
        };

        // 1. Сохранение при отправке формы (Enter в полях ввода)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAndClose();
        });

        // 2. Отдельная обработка Enter (Enter и NumpadEnter) на всём диалоге
        dialog.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.code === 'NumpadEnter') {
                e.preventDefault();
                saveAndClose();
            } else if (e.key === 'Escape') {
                closeDialog();
            }
        });
    }
}