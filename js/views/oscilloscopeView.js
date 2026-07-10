// js/views/oscilloscopeView.js

export function createOscilloscopeView() {
    const container = document.createElement('div');
    container.className = 'osc-internal-container';
    
    const ghost = document.createElement('div');
    ghost.className = 'resize-ghost';
    container.appendChild(ghost);

    container.innerHTML += `
        <div class="osc-toolbar">
            <button title="Открыть">📁</button>
            <button title="Сохранить">💾</button>
            <button title="Пауза">⏸️</button>
            <button title="Стоп">⏹️</button>
            <button title="Настройки">⚙️</button>
        </div>
        <div class="osc-content-area">
            <div class="osc-table-wrapper" style="flex: 0 0 460px;">
                <table class="osc-data-grid">
                    <thead>
                        <tr>
                            <th style="width: 180px; position: relative;">Name<div class="col-resizer"></div></th>
                            <th style="width: 80px; position: relative;">Hex<div class="col-resizer"></div></th>
                            <th style="width: 120px; position: relative;">Physical<div class="col-resizer"></div></th>
                            <th style="width: 80px; position: relative;">Unit<div class="col-resizer"></div></th>
                        </tr>
                    </thead>
                    <tbody id="osc-grid-body"></tbody>
                </table>
            </div>
            <div class="osc-resizer-split"></div>
            <div class="osc-canvas-column">
                <div class="osc-graph-header">Graph</div>
                <div id="osc-canvas-container"></div>
            </div>
        </div>
    `;
    
    const tableWrapper = container.querySelector('.osc-table-wrapper');
    const thElements = container.querySelectorAll('.osc-data-grid th');
    const mainResizer = container.querySelector('.osc-resizer-split');

    // Функция для применения изменений после MouseUp
    const setupResizer = (element, onApply) => {
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            ghost.style.display = 'block';
            ghost.style.left = `${e.clientX}px`;

            const onMouseMove = (moveEvent) => {
                ghost.style.left = `${moveEvent.clientX}px`;
            };
            
            const onMouseUp = (upEvent) => {
                ghost.style.display = 'none';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                
                const delta = upEvent.clientX - startX;
                onApply(delta);
            };
            
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };

    // 1. Ресайз сплиттера: меняет ширину всего блока таблицы
    setupResizer(mainResizer, (delta) => {
        const currentWidth = tableWrapper.getBoundingClientRect().width;
        tableWrapper.style.flex = `0 0 ${Math.max(50, currentWidth + delta)}px`;
    });

    // 2. Ресайз колонок: меняет width ТОЛЬКО конкретной колонки
    thElements.forEach((th) => {
        const handle = th.querySelector('.col-resizer');
        if (!handle) return;
        
        setupResizer(handle, (delta) => {
            const currentThWidth = th.getBoundingClientRect().width;
            th.style.width = `${Math.max(30, currentThWidth + delta)}px`;
            // Обертку не трогаем — таблица подстроится под новые размеры колонок
        });
    });
    
    return container;
}