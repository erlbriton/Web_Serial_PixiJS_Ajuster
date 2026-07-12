// js/ui/ui-resizers.ts

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.left-sidebar-column') as HTMLElement | null;
    const sidebarResizer = document.querySelector('.sidebar-resizer') as HTMLElement | null;
    const wrapper = document.querySelector('.panel-content-wrapper') as HTMLElement | null;
    const oscContainer = document.getElementById('osc-container') as HTMLElement | null;
    
    const MIN_RIGHT_PANEL_WIDTH = 610; 
    const OSCILLOSCOPE_WIDTH = 900;

    function enforceSidebarLimits(): void {
        if (!sidebar || !wrapper || !oscContainer) return;
        
        const containerRect = wrapper.getBoundingClientRect();
        const isOscHidden = oscContainer.classList.contains('hidden');
        const virtualOscOffset = isOscHidden ? OSCILLOSCOPE_WIDTH : 0;
        
        let maxSidebarWidth = containerRect.width - virtualOscOffset - MIN_RIGHT_PANEL_WIDTH;
        if (maxSidebarWidth < 40) maxSidebarWidth = 40;
        
        if (sidebar.offsetWidth > maxSidebarWidth) {
            sidebar.style.width = `${maxSidebarWidth}px`;
        }
    }

    const toggleOscBtn = document.getElementById('toggleOscBtn') as HTMLElement | null;
    
    if (toggleOscBtn && oscContainer) {
        toggleOscBtn.addEventListener('click', () => {
            const isHiding = !oscContainer.classList.contains('hidden');
            oscContainer.classList.toggle('hidden');

            if (isHiding) {
                document.dispatchEvent(new CustomEvent('force-reset-updater'));
            }
            
            enforceSidebarLimits();
        });

        const tooltip = document.createElement('div');
        tooltip.className = 'app-tooltip';
        document.body.appendChild(tooltip);

        const updateTooltipText = (): void => {
            const isHidden = oscContainer.classList.contains('hidden');
            tooltip.textContent = isHidden ? 'Открыть Осциллограф' : 'Закрыть Осциллограф';
        };

        const showTooltip = (e: MouseEvent): void => {
            updateTooltipText();
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        };

        toggleOscBtn.addEventListener('mouseenter', () => {
            toggleOscBtn.addEventListener('mousemove', showTooltip as EventListener);
        });

        toggleOscBtn.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            toggleOscBtn.removeEventListener('mousemove', showTooltip as EventListener);
        });
    }
  
    // --- РЕСАЙЗЕРЫ ---
    if (sidebarResizer && sidebar && wrapper && oscContainer) {
        sidebarResizer.addEventListener('mousedown', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            mouseEvent.preventDefault();
            sidebarResizer.classList.add('active');
            document.body.classList.add('is-resizing');

            const doDragSidebar = (moveEvent: MouseEvent) => {
                const containerRect = wrapper.getBoundingClientRect();
                const isOscHidden = oscContainer.classList.contains('hidden');
                const virtualOscOffset = isOscHidden ? OSCILLOSCOPE_WIDTH : 0;
                
                let maxSidebarWidth = containerRect.width - virtualOscOffset - MIN_RIGHT_PANEL_WIDTH;
                if (maxSidebarWidth < 40) maxSidebarWidth = 40;
                
                let newWidth = moveEvent.clientX - containerRect.left;
                if (newWidth < 40) newWidth = 40; 
                if (newWidth > maxSidebarWidth) newWidth = maxSidebarWidth;
                sidebar.style.width = `${newWidth}px`;
            };

            const stopDragSidebar = () => {
                sidebarResizer.classList.remove('active');
                document.body.classList.remove('is-resizing');
                window.removeEventListener('mousemove', doDragSidebar);
                window.removeEventListener('mouseup', stopDragSidebar);
            };

            window.addEventListener('mousemove', doDragSidebar);
            window.addEventListener('mouseup', stopDragSidebar);
        });
    }

    const table = document.querySelector('.modbus-grid') as HTMLTableElement | null;
    const subHeaders = document.querySelectorAll('.modbus-grid thead tr:last-child th');
    const cols = document.querySelectorAll('.modbus-grid colgroup col');

    if (table) {
        const internalIndices = [0, 1, 2, 4, 6]; 
        internalIndices.forEach(idx => {
            const th = subHeaders[idx] as HTMLElement;
            if (!th) return;
            const resizer = document.createElement('div');
            resizer.className = 'table-resizer internal-resizer';
            th.appendChild(resizer);
            
            resizer.addEventListener('mousedown', (e: Event) => {
                const mouseDownEvent = e as MouseEvent;
                mouseDownEvent.preventDefault();
                resizer.classList.add('active');
                document.body.classList.add('is-resizing');
                
                const startX = mouseDownEvent.clientX;
                const totalTableWidth = table.offsetWidth;
                const startWidthLeft = subHeaders[idx].getBoundingClientRect().width;
                const startWidthRight = subHeaders[idx + 1].getBoundingClientRect().width;
                
                const doDragInternal = (moveEvent: MouseEvent) => {
                    let delta = moveEvent.clientX - startX;
                    if (startWidthLeft + delta < 40) delta = 40 - startWidthLeft;
                    if (startWidthRight - delta < 40) delta = startWidthRight - 40;
                    
                    const pctLeft = ((startWidthLeft + delta) / totalTableWidth) * 100;
                    const pctRight = ((startWidthRight - delta) / totalTableWidth) * 100;
                    
                    (cols[idx] as HTMLElement).style.width = `${pctLeft}%`;
                    (cols[idx + 1] as HTMLElement).style.width = `${pctRight}%`;
                };
                
                const stopDragInternal = () => {
                    resizer.classList.remove('active');
                    document.body.classList.remove('is-resizing');
                    window.removeEventListener('mousemove', doDragInternal);
                    window.removeEventListener('mouseup', stopDragInternal);
                };
                window.addEventListener('mousemove', doDragInternal);
                window.addEventListener('mouseup', stopDragInternal);
            });
        });
        
        // Аналогично типизируйте остальную логику resizer'ов групп...
    }
    enforceSidebarLimits();
});