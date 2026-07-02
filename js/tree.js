import { populateDeviceForm } from './ui.js';

// Глобальный реестр для хранения конфигураций (группировка по Location)
export const deviceRegistry = {};

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
        return true; // Успешно добавлено
    }
    return false; // Уже существовало
}

/**
 * Перерисовывает HTML-дерево в левой панели
 */
export function renderDeviceTree() {
    const container = document.querySelector('.sidebar-tree-container');
    if (!container) return;

    container.innerHTML = ''; // Очищаем старое дерево

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

        // Слой генерации конечных устройств (листьев)
        deviceRegistry[location].forEach(device => {
            const liElement = document.createElement('li');
            // ИСПРАВЛЕНО: Добавили класс 'is-leaf', чтобы убрать маркеры и выровнять отступ
            liElement.className = 'tree-id-item is-leaf'; 
            liElement.textContent = device.displayText;
            liElement.title = device.displayText; 

            // Клик по устройству в дереве переносит данные в форму
            liElement.addEventListener('click', () => {
                populateDeviceForm(device.fullConfig['DEVICE']);
                console.log(`Из дерева выбрано устройство ID: ${device.id}`);
            });

            ulElement.appendChild(liElement);
        });

        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(ulElement);
        container.appendChild(detailsElement);
    }
}