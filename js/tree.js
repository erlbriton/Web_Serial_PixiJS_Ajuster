import { populateDeviceForm } from './ui.js';

// Глобальный реестр для хранения конфигураций (группировка по Location)
export const deviceRegistry = {};

// Переменная для хранения текущей активной конфигурации устройства
let currentDeviceConfig = null;

/**
 * Добавляет устройство в реестр, защищая от дубликатов
 */
export function addDeviceToRegistry(config) {
    if (!config || !config['DEVICE']) return false;

    const dev = config['DEVICE'];
    const location = dev['Location'] || 'Неизвестное место';
    const id = dev['ID'] || dev['Id'] || dev['id'] || 'Без ID';
    const version = dev['Version'] || ''; 
    const date = dev['Date'] || '';

    const displayComponents = [id, version, date].filter(Boolean);
    const deviceDisplayText = displayComponents.join(' ');

    if (!deviceRegistry[location]) {
        deviceRegistry[location] = [];
    }

    const isDuplicate = deviceRegistry[location].some(item => item.id === id);
    if (!isDuplicate) {
        deviceRegistry[location].push({
            id: id,
            displayText: deviceDisplayText,
            fullConfig: config
        });
        return true; 
    }
    return false; 
}

/**
 * Отрисовывает интерактивную таблицу параметров modbus-grid
 */
export function renderModbusTable(fullConfig) {
    const tableBody = document.getElementById('grid-data-rows');
    if (!tableBody) return;

    // Определяем выбранную область памяти (FLASH, CD, RAM) из верхнего комбобокса
    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    const selectedMode = modeSelect ? modeSelect.value : 'FLASH';

    tableBody.innerHTML = ''; // Очищаем старые строки таблицы

    if (!fullConfig || !fullConfig[selectedMode]) return;

    const sectionData = fullConfig[selectedMode];
    let rowNumber = 1;

    // Обходим ключи параметров (p10000, p10100 и т.д.) внутри выбранной секции
    for (const key in sectionData) {
        const parts = sectionData[key];
        
        // Так как твой IniParser уже превратил строку в массив, работаем с ним напрямую
        if (!Array.isArray(parts) || parts.length < 3) continue;

        const name = parts[0] || '';
        const description = parts[1] || '';
        const dataType = parts[2] || '';
        const units = parts[5] || '—';

        let baseHex = '—';
        let basePhysical = '—';

        if (dataType === 'TBit') {
            // Для TBit вытаскиваем дефолтное состояние (последний элемент массива)
            const bitValue = parts[parts.length - 1] ? parts[parts.length - 1].trim() : '0';
            basePhysical = (bitValue === '1' || bitValue === '0') ? bitValue : '0';
            baseHex = basePhysical === '1' ? '0x01' : '0x00';
        } else {
            // Для TWORD / TDWORD ищем базовый hex по умолчанию (элемент в конце, начинающийся с 'x')
            let rawHex = '';
            for (let i = parts.length - 1; i >= 3; i--) {
                if (parts[i] && parts[i].trim().startsWith('x')) {
                    rawHex = parts[i].trim();
                    break;
                }
            }

            if (rawHex && rawHex.startsWith('x')) {
                baseHex = '0x' + rawHex.slice(1).toUpperCase();
                
                // Конвертируем шестнадцатеричное значение в десятичное и применяем масштаб
                const decValue = parseInt(rawHex.slice(1), 16);
                const scale = parseFloat(parts[6]); // Коэффициент масштабирования (индекс 6)
                
                if (!isNaN(decValue) && !isNaN(scale)) {
                    const phys = decValue * scale;
                    // Аккуратно округляем до 4 знаков после запятой, чтобы избежать погрешности JS
                    basePhysical = Number(phys.toFixed(4)).toString();
                } else if (!isNaN(decValue)) {
                    basePhysical = decValue.toString();
                }
            }
        }

        // Данные контроллера остаются пустыми до начала циклического опроса по MODBUS
        const controllerHex = '—';
        const controllerPhysical = '—';

        // Генерируем HTML-строку таблицы
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rowNumber++}</td>
            <td class="param-name" title="${name}">${name}</td>
            <td class="param-desc" title="${description}">${description}</td>
            <td>${units === '*' ? '—' : units}</td>
            <td class="hex-val">${baseHex}</td>
            <td>${basePhysical}</td>
            <td class="hex-val">${controllerHex}</td>
            <td>${controllerPhysical}</td>
        `;

        // Добавляем логику выделения строки
        tr.addEventListener('click', () => {
            // Убираем класс у всех остальных строк
            document.querySelectorAll('#grid-data-rows tr').forEach(el => {
                el.classList.remove('is-selected');
            });
            // Добавляем класс текущей
            tr.classList.add('is-selected');
        });

        tableBody.appendChild(tr);
    }
}

/**
 * Перерисовывает HTML-дерево в левой панели
 */
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
        summaryElement.title = location;

        const ulElement = document.createElement('ul');
        ulElement.className = 'tree-id-list';

        deviceRegistry[location].forEach(device => {
            const liElement = document.createElement('li');
            liElement.className = 'tree-id-item is-leaf'; 
            liElement.textContent = device.displayText;
            liElement.title = device.displayText; 

            liElement.addEventListener('click', () => {
                document.querySelectorAll('.tree-id-item.is-selected').forEach(el => {
                    el.classList.remove('is-selected');
                });
                liElement.classList.add('is-selected');

                // Запоминаем текущую конфигурацию выбранного устройства
                currentDeviceConfig = device.fullConfig;

                // Заполняем форму и обновляем таблицу
                populateDeviceForm(device.fullConfig['DEVICE']);
                renderModbusTable(currentDeviceConfig);

                console.log(`Устройство выбрано: ${device.id}`);
            });

            ulElement.appendChild(liElement);
        });

        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(ulElement);
        container.appendChild(detailsElement);
    }
}

// Навешиваем слушатель на системный комбобокс в тулбаре для моментального переключения табличных данных
document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.querySelector('.toolbar-device-mode-select');
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            if (currentDeviceConfig) {
                renderModbusTable(currentDeviceConfig);
            }
        });
    }
});