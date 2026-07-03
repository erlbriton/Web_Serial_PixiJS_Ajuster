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