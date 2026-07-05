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

    const toggleOscBtn = document.getElementById('toggleOscBtn');
    
    if (toggleOscBtn) {
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

        const updateTooltipText = () => {
            const isHidden = oscContainer.classList.contains('hidden');
            tooltip.textContent = isHidden ? 'Открыть Осциллограф' : 'Закрыть Осциллограф';
        };

        const showTooltip = (e) => {
            updateTooltipText();
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        };

        toggleOscBtn.addEventListener('mouseenter', () => {
            toggleOscBtn.addEventListener('mousemove', showTooltip);
        });

        toggleOscBtn.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            toggleOscBtn.removeEventListener('mousemove', showTooltip);
        });
    }
  
    // --- РЕСАЙЗЕРЫ ---
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

    const table = document.querySelector('.modbus-grid');
    const mainHeaders = document.querySelectorAll('.modbus-grid thead tr:first-child th');
    const subHeaders = document.querySelectorAll('.modbus-grid thead tr:last-child th');
    const cols = document.querySelectorAll('.modbus-grid colgroup col');

    if (table) {
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
                let leftGroupCols = groupIndex === 0 ? [0, 1, 2, 3] : [4, 5];
                let rightGroupCols = groupIndex === 0 ? [4, 5] : [6, 7];
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
                    leftGroupCols.forEach((colIdx, i) => cols[colIdx].style.width = `${((startWidthsLeft[i] * factorLeft) / totalTableWidth) * 100}%`);
                    rightGroupCols.forEach((colIdx, i) => cols[colIdx].style.width = `${((startWidthsRight[i] * factorRight) / totalTableWidth) * 100}%`);
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