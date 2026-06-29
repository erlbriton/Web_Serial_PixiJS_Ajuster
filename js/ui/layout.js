document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.left-sidebar-column');
    const sidebarResizer = document.querySelector('.sidebar-resizer');
    const wrapper = document.querySelector('.panel-content-wrapper');
    const oscContainer = document.getElementById('osc-container');
    
    const MIN_RIGHT_PANEL_WIDTH = 610; 
    const OSCILLOSCOPE_WIDTH = 900;

    function enforceSidebarLimits() {
        if (!sidebar || !wrapper) return;

        const containerRect = wrapper.getBoundingClientRect();
        const isOscHidden = oscContainer.classList.contains('hidden');
        const virtualOscOffset = isOscHidden ? OSCILLOSCOPE_WIDTH : 0;
        
        let maxSidebarWidth = containerRect.width - virtualOscOffset - MIN_RIGHT_PANEL_WIDTH;
        if (maxSidebarWidth < 40) maxSidebarWidth = 40;

        if (sidebar.offsetWidth > maxSidebarWidth) {
            sidebar.style.width = `${maxSidebarWidth}px`;
        }
    }

    // Переключатель осциллографа (UI часть: показать/скрыть панель)
    const toggleOscBtn = document.getElementById('toggleOscBtn');
    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            oscContainer.classList.toggle('hidden');
            enforceSidebarLimits();
            window.dispatchEvent(new Event('resize'));
        });
    }
  
    window.addEventListener('resize', enforceSidebarLimits);

    // РЕСАЙЗ САЙДБАРА
    if (sidebarResizer && sidebar) {
        sidebarResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            sidebarResizer.classList.add('active');
            document.body.classList.add('is-resizing');

            const doDragSidebar = (moveEvent) => {
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

    // Кэш таблицы для внутренних ресайзеров
    const table = document.querySelector('.modbus-grid');
    const mainHeaders = document.querySelectorAll('.modbus-grid thead tr:first-child th');
    const subHeaders = document.querySelectorAll('.modbus-grid thead tr:last-child th');
    const cols = document.querySelectorAll('.modbus-grid colgroup col');

    if (table) {
        // РЕСАЙЗ ОДИНОЧНЫХ ВНУТРЕННИХ КОЛОНОК
        const internalIndices = [0, 1, 2, 4, 6]; 
        
        internalIndices.forEach(idx => {
            const th = subHeaders[idx];
            if (!th) return;
            
            const resizer = document.createElement('div');
            resizer.className = 'table-resizer internal-resizer';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                resizer.classList.add('active');
                document.body.classList.add('is-resizing');

                const startX = e.clientX;
                const totalTableWidth = table.offsetWidth;
                const startWidthLeft = subHeaders[idx].getBoundingClientRect().width;
                const startWidthRight = subHeaders[idx + 1].getBoundingClientRect().width;

                const doDragInternal = (moveEvent) => {
                    let delta = moveEvent.clientX - startX;

                    if (startWidthLeft + delta < 40) delta = 40 - startWidthLeft;
                    if (startWidthRight - delta < 40) delta = startWidthRight - 40;

                    const pctLeft = ((startWidthLeft + delta) / totalTableWidth) * 100;
                    const pctRight = ((startWidthRight - delta) / totalTableWidth) * 100;

                    cols[idx].style.width = `${pctLeft}%`;
                    cols[idx + 1].style.width = `${pctRight}%`;
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

        // ГРУППОВОЙ РЕСАЙЗ ДЛЯ ГЛАВНЫХ ГРУПП
        mainHeaders.forEach((th, groupIndex) => {
            if (groupIndex === mainHeaders.length - 1) return; 

            const resizer = document.createElement('div');
            resizer.className = 'table-resizer group-resizer';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                resizer.classList.add('active');
                document.body.classList.add('is-resizing');
                
                const startX = e.clientX;
                const totalTableWidth = table.offsetWidth; 
                
                let leftGroupCols = [];
                let rightGroupCols = [];

                if (groupIndex === 0) {
                    leftGroupCols = [0, 1, 2, 3]; 
                    rightGroupCols = [4, 5];       
                } else if (groupIndex === 1) {
                    leftGroupCols = [4, 5];       
                    rightGroupCols = [6, 7];       
                }

                const startWidthsLeft = leftGroupCols.map(idx => subHeaders[idx].getBoundingClientRect().width);
                const startWidthsRight = rightGroupCols.map(idx => subHeaders[idx].getBoundingClientRect().width);

                const totalStartWidthLeft = startWidthsLeft.reduce((sum, w) => sum + w, 0);
                const totalStartWidthRight = startWidthsRight.reduce((sum, w) => sum + w, 0);

                if (totalStartWidthLeft === 0 || totalStartWidthRight === 0) return;

                const doDragGroup = (moveEvent) => {
                    let delta = moveEvent.clientX - startX;
                    
                    if (totalStartWidthLeft + delta < 90) delta = 90 - totalStartWidthLeft;
                    if (totalStartWidthRight - delta < 90) delta = totalStartWidthRight - 90;
                    
                    const factorLeft = (totalStartWidthLeft + delta) / totalStartWidthLeft;
                    const factorRight = (totalStartWidthRight - delta) / totalStartWidthRight;
                    
                    leftGroupCols.forEach((colIdx, i) => {
                        const newWidthPx = startWidthsLeft[i] * factorLeft;
                        cols[colIdx].style.width = `${(newWidthPx / totalTableWidth) * 100}%`;
                    });
                    
                    rightGroupCols.forEach((colIdx, i) => {
                        const newWidthPx = startWidthsRight[i] * factorRight;
                        cols[colIdx].style.width = `${(newWidthPx / totalTableWidth) * 100}%`;
                    });
                };

                const stopDragGroup = () => {
                    resizer.classList.remove('active');
                    document.body.classList.remove('is-resizing');
                    window.removeEventListener('mousemove', doDragGroup);
                    window.removeEventListener('mouseup', stopDragGroup);
                };

                window.addEventListener('mousemove', doDragGroup);
                window.addEventListener('mouseup', stopDragGroup);
            });
        });
    }

    enforceSidebarLimits();
});