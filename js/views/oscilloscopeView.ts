import { OSCILLOSCOPE_TEMPLATE } from '../templates/oscilloscopeTemplate.js';

export function createOscilloscopeView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'osc-container';
    container.innerHTML = OSCILLOSCOPE_TEMPLATE;

    // Начальные ширины колонок (в пикселях)
    let colWidths = {
        name: 180,
        hex: 90,
        phys: 110,
        unit: 80
    };

    // Функция применения ширин через CSS-переменные
    const applyWidths = () => {
        container.style.setProperty('--name-width', `${colWidths.name}px`);
        container.style.setProperty('--hex-width', `${colWidths.hex}px`);
        container.style.setProperty('--phys-width', `${colWidths.phys}px`);
        container.style.setProperty('--unit-width', `${colWidths.unit}px`);

        // Обновляем ширину левой панели = сумма всех колонок
        const totalWidth = colWidths.name + colWidths.hex + colWidths.phys + colWidths.unit;
        const leftPanel = container.querySelector('#osc-left-panel') as HTMLElement;
        leftPanel.style.flex = `0 0 ${totalWidth}px`;
    };

    // Генерация строк с данными
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
///////////////////////////////////////////////////////////
                                                // Временно выводим тип параметра прямо в колонку Unit для проверки
                        rowDiv.innerHTML = `
                <div class="col col-name" title="${row.signal.name}">${row.signal.name}</div>
                <div class="col col-hex">${row.signal.register.toString(16).toUpperCase().padStart(4, '0')}</div>
                <div class="col col-phys">${typeof row.signal.currentValue === 'number' ? row.signal.currentValue.toFixed(2) : row.signal.currentValue}</div>
                <div class="col col-unit">${row.signal.dataType === 'TBit' ? '' : row.signal.unit}</div>
                <div class="col col-graph"></div>
            `;
            
            bodyContainer.appendChild(rowDiv);
        });/////////////////////////////////////////////////////
    };

    renderLeftRows();
    applyWidths(); // Применяем начальные ширины

    // Сплиттер основной панели (оставляем как есть — он уже работает по нужному принципу)
    const leftPanel = container.querySelector('#osc-left-panel') as HTMLElement;
    const panelSplitter = container.querySelector('#osc-panel-splitter') as HTMLElement;

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
            panelSplitter.style.transform = `translateX(${finalWidth - startWidth}px)`;
        };

        const stopPanelDrag = () => {
            panelSplitter.classList.remove('active');
            document.body.classList.remove('is-resizing');
            panelSplitter.style.transform = '';
            leftPanel.style.flex = `0 0 ${finalWidth}px`;

            // Пересчитываем ширины колонок пропорционально новой ширине панели
            const scale = finalWidth / (colWidths.name + colWidths.hex + colWidths.phys + colWidths.unit);
            colWidths.name = Math.max(30, Math.round(colWidths.name * scale));
            colWidths.hex = Math.max(30, Math.round(colWidths.hex * scale));
            colWidths.phys = Math.max(30, Math.round(colWidths.phys * scale));
            colWidths.unit = Math.max(30, Math.round(colWidths.unit * scale));

            applyWidths();

            window.removeEventListener('mousemove', doPanelDrag);
            window.removeEventListener('mouseup', stopPanelDrag);
        };

        window.addEventListener('mousemove', doPanelDrag);
        window.addEventListener('mouseup', stopPanelDrag);
    });

    // === РЕСАЙЗ КОЛОНОК (ТОЛЬКО ПРИ ОТПУСКАНИИ МЫШКИ) ===
    const initColumnResizers = () => {
        const headerLeft = container.querySelector('.osc-main-header-left') as HTMLElement;
        if (!headerLeft) return;

        const headers = Array.from(headerLeft.querySelectorAll('.c-name, .c-hex, .c-phys, .c-unit')) as HTMLElement[];

        headers.forEach((th) => {
            const resizer = document.createElement('div');
            resizer.className = 'osc-table-resizer';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e: Event) => {
                e.preventDefault();
                e.stopPropagation();

                const startX = (e as MouseEvent).clientX;
                const currentWidth = th.getBoundingClientRect().width;

                let cssVarName = '';
                let key: keyof typeof colWidths | null = null;

                if (th.classList.contains('c-name')) { cssVarName = '--name-width'; key = 'name'; }
                else if (th.classList.contains('c-hex')) { cssVarName = '--hex-width'; key = 'hex'; }
                else if (th.classList.contains('c-phys')) { cssVarName = '--phys-width'; key = 'phys'; }
                else if (th.classList.contains('c-unit')) { cssVarName = '--unit-width'; key = 'unit'; }

                if (!cssVarName || !key) return;

                // Сохраняем начальные значения для восстановления при отмене
                const startWidth = currentWidth;
                let newWidth = startWidth;

                // Визуальный ресайзер: двигаем только саму полоску
                const onMouseMove = (me: MouseEvent) => {
                    const delta = me.clientX - startX;
                    newWidth = Math.max(30, startWidth + delta);
                    // Меняем только transform у ресайзера, чтобы не вызывать перерисовку
                    resizer.style.transform = `translateX(${delta}px)`;
                };

                const onMouseUp = () => {
                    resizer.classList.remove('active');
                    document.body.classList.remove('is-resizing');
                    resizer.style.transform = ''; // Сбрасываем визуальный сдвиг
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);

                    // ТОЛЬКО ЗДЕСЬ, при отпускании, обновляем реальную ширину
                    colWidths[key!] = newWidth;
                    applyWidths();
                };

                resizer.classList.add('active');
                document.body.classList.add('is-resizing');
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });
        });
    };

    initColumnResizers();

    return container;
}