/**
 * Отображает кастомное модальное окно
 */
export function showIdModal(text) {
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

    const close = () => overlay.remove();
    modal.querySelector('.id-modal-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

/**
 * Обновляет текст в верхнем баннере ID
 */
export function updateIdBanner(idText) {
    const idSpan = document.querySelector('.id-banner span');
    if (idSpan) {
        idSpan.textContent = idText;
    }
}

/**
 * Закрывает модальное окно ID, если оно открыто
 */
export function closeIdModal() {
    const modal = document.querySelector('.id-modal-overlay');
    if (modal) modal.remove();
}

/**
 * Заполняет форму устройства данными из конфигурации
 */
export function populateDeviceForm(devConfig) {
    if (!devConfig) return;
    
    const mechanismInput = document.querySelector('.mechanism-input');
    const locationInput = document.querySelector('.location-input');
    const dateInput = document.querySelector('.date-input');

    if (mechanismInput && devConfig['Description'] !== undefined) {
        mechanismInput.value = devConfig['Description'];
    }
    if (locationInput && devConfig['Location'] !== undefined) {
        locationInput.value = devConfig['Location'];
    }
    if (dateInput && devConfig['Date'] !== undefined) {
        dateInput.value = devConfig['Date'];
    }
}