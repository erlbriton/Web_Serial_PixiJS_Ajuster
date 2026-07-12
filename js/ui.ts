// js/ui/ui.ts

/**
 * Отображает кастомное модальное окно
 */
export function showIdModal(text: string): void {
    const existing = document.querySelector('.id-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'id-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'id-modal';
    
    modal.innerHTML = `
        <div class="id-modal-content">
            <span class="id-modal-text">${text}</span>
            <button class="id-modal-btn">OK</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = (): void => overlay.remove();
    
    const btn = modal.querySelector('.id-modal-btn') as HTMLButtonElement | null;
    btn?.addEventListener('click', close);
    
    overlay.addEventListener('click', (e: Event) => { 
        if (e.target === overlay) close(); 
    });
}

/**
 * Обновляет текст в верхнем баннере ID
 */
export function updateIdBanner(idText: string): void {
    const idSpan = document.querySelector('.id-banner span') as HTMLElement | null;
    if (idSpan) {
        idSpan.textContent = idText;
    }
}

/**
 * Закрывает модальное окно ID, если оно открыто
 */
export function closeIdModal(): void {
    const modal = document.querySelector('.id-modal-overlay');
    if (modal) modal.remove();
}

/**
 * Заполняет форму устройства данными из конфигурации
 */
export function populateDeviceForm(devConfig: Record<string, string | number>): void {
    if (!devConfig) return;
    
    const mechanismInput = document.querySelector('.mechanism-input') as HTMLInputElement | null;
    const locationInput = document.querySelector('.location-input') as HTMLInputElement | null;
    const dateInput = document.querySelector('.date-input') as HTMLInputElement | null;

    if (mechanismInput && devConfig['Description'] !== undefined) {
        mechanismInput.value = String(devConfig['Description']);
    }
    if (locationInput && devConfig['Location'] !== undefined) {
        locationInput.value = String(devConfig['Location']);
    }
    if (dateInput && devConfig['Date'] !== undefined) {
        dateInput.value = String(devConfig['Date']);
    }
}