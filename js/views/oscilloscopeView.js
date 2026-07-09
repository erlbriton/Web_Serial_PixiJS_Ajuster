// js/views/oscilloscopeView.js

export function createOscilloscopeView() {
    const container = document.createElement('div');
    container.className = 'osc-internal-container';
    
    // HTML структура согласно вашему ТЗ: 
    // 1. Панель кнопок (номинально)
    // 2. Таблица (4 колонки)
    // 3. Область осциллографа
    container.innerHTML = `
        <div class="osc-toolbar">
            <button title="Открыть">📁</button>
            <button title="Сохранить">💾</button>
            <button title="Пауза">⏸️</button>
            <button title="Стоп">⏹️</button>
            <button title="Настройки">⚙️</button>
        </div>
        <div class="osc-content-area">
            <table class="osc-data-grid">
                <thead>
                    <tr>
                        <th>name</th>
                        <th>hex</th>
                        <th>physical</th>
                        <th>unit</th>
                    </tr>
                </thead>
                <tbody id="osc-grid-body">
                    <!-- Сюда JS будет добавлять данные -->
                </tbody>
            </table>
            <div id="osc-canvas-container"></div>
        </div>
    `;
    
    return container;
}