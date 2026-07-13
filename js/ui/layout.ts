export function initLayout() {
    console.log("DEBUG: Скрипт ресайза запущен в файле layout.ts");

    // --- РЕСАЙЗЕР БОКОВОЙ ПАНЕЛИ ---
    const sidebar = document.querySelector('.left-sidebar-column') as HTMLElement | null;
    if (sidebar) {
        sidebar.style.position = 'relative'; // Чтобы ресайзер позиционировался относительно колонки
        const resizer = document.createElement('div');
        resizer.className = 'table-resizer sidebar-resizer';      
        sidebar.appendChild(resizer);
        console.log("DEBUG: Ресайзер боковой панели создан и скрыт");
        
        // Добавляем логику перетаскивания для боковой панели
        resizer.addEventListener('mousedown', (e: Event) => {
            const mouseDown = e as MouseEvent;
            mouseDown.preventDefault();
            
            const startX = mouseDown.clientX;
            const startWidth = sidebar.offsetWidth;
            
            const onMouseMove = (moveEvent: MouseEvent) => {
                const newWidth = startWidth + (moveEvent.clientX - startX);
                // Устанавливаем минимальную ширину 100px, чтобы панель не исчезла
                if (newWidth > 100) {
                    sidebar.style.setProperty('width', newWidth + 'px', 'important');
                }
            };
            
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // --- ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ ---
    const table = document.querySelector('.modbus-grid') as HTMLTableElement | null;
    const mainHeaders = document.querySelectorAll('.modbus-grid thead tr:first-child th') as NodeListOf<HTMLTableHeaderCellElement>;
    const subHeaders = document.querySelectorAll('.modbus-grid thead tr:last-child th') as NodeListOf<HTMLTableHeaderCellElement>;

    if (table) {
        // Ресайзеры ячеек
        const internalIndices = [0, 1, 2, 4, 6]; 
        internalIndices.forEach(idx => {
            const th = subHeaders[idx];
            if (!th) return;
            
            const resizer = document.createElement('div');
            resizer.className = 'table-resizer internal-resizer';
            th.appendChild(resizer);
            
            resizer.addEventListener('mousedown', (e: Event) => {
                const mouseDownEvent = e as MouseEvent;
                mouseDownEvent.preventDefault();
                resizer.classList.add('active');
                document.body.classList.add('is-resizing');
                
                const currentCols = table.querySelectorAll('colgroup col');
                console.log(`[Resize Debug] Найдено колонок colgroup: ${currentCols.length}`);
                
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
                    
                    if (currentCols[idx]) {
                        (currentCols[idx] as HTMLElement).style.width = `${pctLeft}%`;
                        console.log(`[Resize Debug] Применяю ширину col[${idx}]: ${pctLeft}%`);
                    } else {
                        console.warn(`[Resize Debug] ОШИБКА: Колонки col[${idx}] не существует!`);
                    }
                    
                    if (currentCols[idx + 1]) {
                        (currentCols[idx + 1] as HTMLElement).style.width = `${pctRight}%`;
                    }
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

        // Ресайзеры групп
       mainHeaders.forEach((th, groupIndex) => {
            console.log(`DEBUG: Найден header[${groupIndex}] с текстом: "${th.innerText.trim()}"`);
            if (groupIndex === mainHeaders.length - 1) return; 
            
            const resizer = document.createElement('div');
            resizer.className = 'table-resizer group-resizer';
            th.appendChild(resizer);
            
            resizer.addEventListener('mousedown', (e: Event) => {
            console.log("DEBUG: Клик по group-resizer для индекса", groupIndex);
            const mouseDownEvent = e as MouseEvent;
            mouseDownEvent.preventDefault();
            resizer.classList.add('active');
            document.body.classList.add('is-resizing');
                
                const currentCols = table.querySelectorAll('colgroup col');
                const startX = mouseDownEvent.clientX;
                const totalTableWidth = table.offsetWidth; 
                
                const leftGroupCols = groupIndex === 0 ? [0, 1, 2, 3] : [4, 5];
                const rightGroupCols = groupIndex === 0 ? [4, 5] : [6, 7];
                
                const startWidthsLeft = leftGroupCols.map(idx => subHeaders[idx].getBoundingClientRect().width);
                const startWidthsRight = rightGroupCols.map(idx => subHeaders[idx].getBoundingClientRect().width);
                
                const totalStartWidthLeft = startWidthsLeft.reduce((sum, w) => sum + w, 0);
                const totalStartWidthRight = startWidthsRight.reduce((sum, w) => sum + w, 0);
                
                if (totalStartWidthLeft === 0 || totalStartWidthRight === 0) return;
                
                const doDragGroup = (moveEvent: MouseEvent) => {
                    let delta = moveEvent.clientX - startX;
                    if (totalStartWidthLeft + delta < 90) delta = 90 - totalStartWidthLeft;
                    if (totalStartWidthRight - delta < 90) delta = totalStartWidthRight - 90;
                    
                    const factorLeft = (totalStartWidthLeft + delta) / totalStartWidthLeft;
                    const factorRight = (totalStartWidthRight - delta) / totalStartWidthRight;
                    
                    leftGroupCols.forEach((colIdx, i) => {
                        if (currentCols[colIdx]) {
                             (currentCols[colIdx] as HTMLElement).style.width = `${((startWidthsLeft[i] * factorLeft) / totalTableWidth) * 100}%`;
                        }
                    });
                    rightGroupCols.forEach((colIdx, i) => {
                        if (currentCols[colIdx]) {
                            (currentCols[colIdx] as HTMLElement).style.width = `${((startWidthsRight[i] * factorRight) / totalTableWidth) * 100}%`;
                        }
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
}