// js/oscilloscope/parts_pixiOscilloscope/openMenu.ts

export interface ContextMenuOptions {
    x: number;
    y: number;
    onProperties: () => void;
    onDelete: () => void;
}

export function openRowContextMenu(options: ContextMenuOptions): void {
    // 1. Закрываем предыдущее меню, если оно уже открыто
    closeRowContextMenu();

    const menu = document.createElement('div');
    menu.id = 'osc-row-context-menu';

    // Корректируем позицию, если меню выходит за края экрана
    const menuWidth = 170;
    const menuHeight = 80;
    let left = options.x;
    let top = options.y;

    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 8;
    }
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 8;
    }

    menu.style.cssText = `
        position: fixed !important;
        left: ${left}px !important;
        top: ${top}px !important;
        background-color: #2b2b2b !important;
        border: 1px solid #555 !important;
        border-radius: 4px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important;
        padding: 4px 0 !important;
        z-index: 999999 !important;
        min-width: 160px !important;
        font-family: sans-serif !important;
        font-size: 13px !important;
        color: #ffffff !important;
        user-select: none !important;
    `;

    menu.innerHTML = `
        <div id="osc-ctx-properties" style="padding: 8px 14px; cursor: pointer; transition: background 0.15s;">
            ⚙ Свойства параметра
        </div>
        <div style="height: 1px; background: #444; margin: 4px 0;"></div>
        <div id="osc-ctx-delete" style="padding: 8px 14px; cursor: pointer; color: #ff6b6b; transition: background 0.15s;">
            🗑 Удалить
        </div>
    `;

    document.body.appendChild(menu);

    const propertiesBtn = menu.querySelector('#osc-ctx-properties') as HTMLElement;
    const deleteBtn = menu.querySelector('#osc-ctx-delete') as HTMLElement;

    if (propertiesBtn) {
        propertiesBtn.addEventListener('mouseenter', () => propertiesBtn.style.background = '#3d3d3d');
        propertiesBtn.addEventListener('mouseleave', () => propertiesBtn.style.background = 'transparent');
        propertiesBtn.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            closeRowContextMenu();
            options.onProperties();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#3d3d3d');
        deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'transparent');
        deleteBtn.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            closeRowContextMenu();
            options.onDelete();
        });
    }

    // Закрытие при клике мимо меню
    const onOutsideClick = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
            closeRowContextMenu();
            document.removeEventListener('click', onOutsideClick);
            document.removeEventListener('contextmenu', onOutsideClick);
        }
    };

    // Задержка в 50мс перед навешиванием слушателя, чтобы сам событие открытия не закрыло меню
    setTimeout(() => {
        document.addEventListener('click', onOutsideClick);
        document.addEventListener('contextmenu', onOutsideClick);
    }, 50);
}

export function closeRowContextMenu(): void {
    const existing = document.getElementById('osc-row-context-menu');
    if (existing) {
        existing.remove();
    }
}