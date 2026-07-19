import { OSCILLOSCOPE_TEMPLATE } from '../templates/oscilloscopeTemplate.js';

export function createOscilloscopeView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'osc-container';
    container.innerHTML = OSCILLOSCOPE_TEMPLATE;

    // Генерация строк с 5 колонками внутри .osc-body
    const renderLeftRows = () => {
        const model = (window as any).oscModel;
        if (!model) return;
        
        const bodyContainer = container.querySelector('#osc-grid-body') as HTMLElement;
        if (!bodyContainer) return;

        bodyContainer.innerHTML = '';

        model.rows.forEach((row: any) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'osc-data-row';
            rowDiv.style.height = `${row.height}px`;

            const hexVal = row.signal.register.toString(16).toUpperCase().padStart(4, '0');
            const physVal = typeof row.signal.currentValue === 'number' 
                ? row.signal.currentValue.toFixed(2) 
                : row.signal.currentValue;

            rowDiv.innerHTML = `
                <div class="col col-name" title="${row.signal.name}">${row.signal.name}</div>
                <div class="col col-hex">${hexVal}</div>
                <div class="col col-phys">${physVal}</div>
                <div class="col col-unit">${row.signal.unit}</div>
                <div class="col col-graph"></div>
            `;
            
            bodyContainer.appendChild(rowDiv);
        });
    };

    renderLeftRows();

    const leftPanel = container.querySelector('#osc-left-panel') as HTMLElement;
    const panelSplitter = container.querySelector('#osc-panel-splitter') as HTMLElement;
    const headerLeft = container.querySelector('.osc-main-header-left') as HTMLElement;

    panelSplitter.addEventListener('mousedown', (e: Event) => {
        const md = e as MouseEvent;
        md.preventDefault();
        panelSplitter.classList.add('active');
        document.body.classList.add('is-resizing');

        const startX = md.clientX;
        const startWidth = leftPanel.offsetWidth;
        let finalWidth = startWidth; 

        const doPanelDrag = (me: MouseEvent) => {
            finalWidth = Math.max(200, startWidth + (me.clientX - startX));
            // УБРАНО: строка, которая двигала шапку в реальном времени
        };

        const stopPanelDrag = () => {
            panelSplitter.classList.remove('active');
            document.body.classList.remove('is-resizing');
            panelSplitter.style.transform = '';
            leftPanel.style.flex = `0 0 ${finalWidth}px`;
            // Теперь шапка двигается только здесь, при отпускании мышки
            if (headerLeft) {
                headerLeft.style.flex = `0 0 ${finalWidth}px`;
            }
            window.removeEventListener('mousemove', doPanelDrag);
            window.removeEventListener('mouseup', stopPanelDrag);
        };

        window.addEventListener('mousemove', doPanelDrag);
        window.addEventListener('mouseup', stopPanelDrag);
    });

    return container;
}