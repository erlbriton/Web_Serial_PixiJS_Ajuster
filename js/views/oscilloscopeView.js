export function createOscilloscopeView() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flex = '1';
    container.style.height = '100%';
    container.style.width = '100%';

    container.innerHTML = `
        <div class="osc-table-wrapper" id="osc-left-panel">
            <table class="osc-data-grid">
                <colgroup>
                    <col style="width: 40%">
                    <col style="width: 20%">
                    <col style="width: 20%">
                    <col style="width: 20%">
                </colgroup>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Hex</th>
                        <th>Physical</th>
                        <th>Unit</th>
                    </tr>
                </thead>
                <tbody id="osc-grid-body"></tbody>
            </table>
        </div>
        <div class="osc-main-splitter" id="osc-panel-splitter"></div>
        <div class="osc-canvas-column" id="osc-canvas-container"></div>
    `;

    // 1. ЛОГИКА РЕСАЙЗА ВСЕЙ ПАНЕЛИ (СКАЧКОМ ПО ОТПУСКАНИЮ МЫШИ)
    const leftPanel = container.querySelector('#osc-left-panel');
    const panelSplitter = container.querySelector('#osc-panel-splitter');

    panelSplitter.addEventListener('mousedown', (e) => {
        e.preventDefault();
        panelSplitter.classList.add('active');
        document.body.classList.add('is-resizing');

        const startX = e.clientX;
        const startWidth = leftPanel.offsetWidth;
        let finalWidth = startWidth; // Переменная для хранения итоговой ширины

        const doPanelDrag = (moveEvent) => {
            let delta = moveEvent.clientX - startX;
            finalWidth = startWidth + delta;
            
            // Ограничение минимальной ширины
            if (finalWidth < 200) {
                finalWidth = 200;
                delta = 200 - startWidth; // Корректируем смещение разделителя
            }

            // ВАЖНО: Двигаем только сам сплиттер визуально, не трогая размеры панелей!
            panelSplitter.style.transform = `translateX(${delta}px)`;
        };

        const stopPanelDrag = () => {
            panelSplitter.classList.remove('active');
            document.body.classList.remove('is-resizing');
            
            // Убираем визуальное смещение сплиттера
            panelSplitter.style.transform = '';
            
            // И только теперь ОДНИМ СКАЧКОМ применяем новую ширину
            leftPanel.style.flex = `0 0 ${finalWidth}px`;
            
            window.removeEventListener('mousemove', doPanelDrag);
            window.removeEventListener('mouseup', stopPanelDrag);
        };

        window.addEventListener('mousemove', doPanelDrag);
        window.addEventListener('mouseup', stopPanelDrag);
    });

    // 2. ЛОГИКА РЕСАЙЗА КОЛОНОК ВНУТРИ ТАБЛИЦЫ (Остается плавной, т.к. не влияет на графики)
    const table = container.querySelector('.osc-data-grid');
    const headers = container.querySelectorAll('.osc-data-grid thead th');
    const cols = container.querySelectorAll('colgroup col');

    headers.forEach((th, idx) => {
        if (idx === headers.length - 1) return;

        const resizer = document.createElement('div');
        resizer.className = 'osc-table-resizer';
        th.appendChild(resizer);

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            resizer.classList.add('active');
            document.body.classList.add('is-resizing');

            const startX = e.clientX;
            const totalTableWidth = table.offsetWidth;
            const startWidthLeft = headers[idx].getBoundingClientRect().width;
            const startWidthRight = headers[idx + 1].getBoundingClientRect().width;

            const doColDrag = (moveEvent) => {
                let delta = moveEvent.clientX - startX;

                // Ограничения 40px
                if (startWidthLeft + delta < 40) delta = 40 - startWidthLeft;
                if (startWidthRight - delta < 40) delta = startWidthRight - 40;

                const pctLeft = ((startWidthLeft + delta) / totalTableWidth) * 100;
                const pctRight = ((startWidthRight - delta) / totalTableWidth) * 100;

                cols[idx].style.width = `${pctLeft}%`;
                cols[idx + 1].style.width = `${pctRight}%`;
            };

            const stopColDrag = () => {
                resizer.classList.remove('active');
                document.body.classList.remove('is-resizing');
                window.removeEventListener('mousemove', doColDrag);
                window.removeEventListener('mouseup', stopColDrag);
            };

            window.addEventListener('mousemove', doColDrag);
            window.addEventListener('mouseup', stopColDrag);
        });
    });

    return container;
}