import { populateDeviceForm } from './ui.js';

export const deviceRegistry = {};
let currentDeviceConfig = null;

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
    let rowNumber = 1;

    // Обходим ключи параметров внутри выбранной секции
    for (const key in sectionData) {
        const parts = sectionData[key];
        
        if (!Array.isArray(parts) || parts.length < 3) continue;

        const name = parts[0] || '';
        const description = parts[1] || '';
        const dataType = parts[2] || '';
        const units = parts[5] || '—';

        let baseHex = '—', basePhysical = '—';

        if (dataType === 'TBit') {
            const bitValue = parts[parts.length - 1] ? parts[parts.length - 1].trim() : '0';
            basePhysical = (bitValue === '1' || bitValue === '0') ? bitValue : '0';
            baseHex = basePhysical === '1' ? '0x01' : '0x00';
        } else {
            let rawHex = '';
            for (let i = parts.length - 1; i >= 3; i--) {
                if (parts[i] && parts[i].trim().startsWith('x')) {
                    rawHex = parts[i].trim();
                    break;
                }
            }
            if (rawHex && rawHex.startsWith('x')) {
                baseHex = '0x' + rawHex.slice(1).toUpperCase();
                const decValue = parseInt(rawHex.slice(1), 16);
                const scale = parseFloat(parts[6]);
                if (!isNaN(decValue) && !isNaN(scale)) {
                    basePhysical = Number((decValue * scale).toFixed(4)).toString();
                } else if (!isNaN(decValue)) {
                    basePhysical = decValue.toString();
                }
            }
        }

        const tr = document.createElement('tr');
        // Заменили ${rowNumber++} на ${key} для вывода префикса 'p'
        tr.innerHTML = `
            <td>${key}</td>
            <td class="param-name" title="${name}">${name}</td>
            <td class="param-desc" title="${description}">${description}</td>
            <td>${units === '*' ? '—' : units}</td>
            <td class="hex-val">${baseHex}</td>
            <td>${basePhysical}</td>
            <td class="hex-val">—</td>
            <td>—</td>
        `;

        tr.addEventListener('click', () => {
            document.querySelectorAll('#grid-data-rows tr').forEach(el => el.classList.remove('is-selected'));
            tr.classList.add('is-selected');
        });

        tableBody.appendChild(tr);
    }

    // ВАЖНО: Вызываем функцию ресайза после того, как таблица отрисована
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