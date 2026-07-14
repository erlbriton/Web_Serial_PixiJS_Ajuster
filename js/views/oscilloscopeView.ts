import { OSCILLOSCOPE_TEMPLATE } from '../templates/oscilloscopeTemplate';

export function createOscilloscopeView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'osc-container';
    container.innerHTML = OSCILLOSCOPE_TEMPLATE;

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
            window.removeEventListener('mousemove', doPanelDrag);
            window.removeEventListener('mouseup', stopPanelDrag);
        };

        window.addEventListener('mousemove', doPanelDrag);
        window.addEventListener('mouseup', stopPanelDrag);
    });

    const table = container.querySelector('.osc-data-grid') as HTMLTableElement;
    const headers = container.querySelectorAll('.osc-data-grid thead th') as NodeListOf<HTMLElement>;
    const cols = container.querySelectorAll('colgroup col') as NodeListOf<HTMLElement>;

    headers.forEach((th, idx) => {
        if (idx === headers.length - 1) return;
        const resizer = document.createElement('div');
        resizer.className = 'osc-table-resizer';
        th.appendChild(resizer);

        resizer.addEventListener('mousedown', (e: Event) => {
            const md = e as MouseEvent;
            md.preventDefault();
            resizer.classList.add('active');
            document.body.classList.add('is-resizing');

            const startX = md.clientX;
            const startWidthLeft = headers[idx].getBoundingClientRect().width;
            const startWidthRight = headers[idx + 1].getBoundingClientRect().width;
            const totalTableWidth = table.offsetWidth;

            const doColDrag = (me: MouseEvent) => {
                const delta = me.clientX - startX;
                const newWidthLeft = Math.max(40, startWidthLeft + delta);
                const newWidthRight = Math.max(40, startWidthRight - (newWidthLeft - startWidthLeft));
                cols[idx].style.width = `${(newWidthLeft / totalTableWidth) * 100}%`;
                cols[idx + 1].style.width = `${(newWidthRight / totalTableWidth) * 100}%`;
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