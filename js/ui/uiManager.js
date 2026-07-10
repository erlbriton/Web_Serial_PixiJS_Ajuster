// js/ui/uiManager.js
import { createOscilloscopeView } from '../views/oscilloscopeView.js';

function injectCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

export function initUI(deps) {
    const { 
        serial, appState, parser, view, buffers, 
        setupFileHandling, setupFolderHandling, updateComInterfaceName,
        executeDeviceIdentification, readLoop, showIdModal, updateDeviceRegisters 
    } = deps;

    // 1. Внедрение компонента Monitor
    // Теперь мы берем существующий контейнер и убираем у него класс "hidden"
    const oscContainer = document.getElementById('osc-container');
    
    if (oscContainer) {
       // oscContainer.classList.remove('hidden');
        // Добавляем содержимое (функция createOscilloscopeView должна быть доступна)
        //oscContainer.appendChild(createOscilloscopeView());
    }

    // 2. DOM Элементы
    const filePicker = document.getElementById('filePicker');
    const folderPicker = document.getElementById('folderPicker');
    const idBtn = document.getElementById("idBtn");
    const connectBtn = document.getElementById("connectBtn");
    const comSelect = document.getElementById("comSelect");
    const toggleOscBtn = document.getElementById('toggleOscBtn');
    const refreshBtn = document.getElementById("refresh-btn");
    const folderActionBtn = document.getElementById('folderActionBtn');
    const folderArrowBtn = document.getElementById('folderArrowBtn');
    const folderDropdown = document.getElementById('folderDropdown');
    const menuOpenFile = document.getElementById('menuOpenFile');
    const menuOpenFolder = document.getElementById('menuOpenFolder');

    // 3. Инициализация логики файлов
    if (filePicker) setupFileHandling(filePicker, appState);
    if (folderPicker && typeof setupFolderHandling === 'function') setupFolderHandling(folderPicker);

    // 4. События кнопок
    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            if (serial.isConnected) { showIdModal("Порт уже открыт!"); return; }
            try {
                await serial.connect(115200);
                const chipName = updateComInterfaceName(serial, comSelect);
                console.log(`Успешно подключено к: ${chipName}`);
            } catch (err) { showIdModal("Ошибка: " + err.message); }
        });
    }

    if (idBtn) {
        idBtn.addEventListener("click", async () => {
            if (serial.isConnected) { showIdModal("Порт уже открыт!"); return; }
            await executeDeviceIdentification(serial, comSelect, appState);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            if (!serial?.isConnected) { showIdModal("Устройство не подключено!"); return; }
            if (appState.isRefreshing) return;
            
            appState.isRefreshing = true; // Блокируем всё остальное
            refreshBtn.disabled = true;
            
            try {
                // 1. Сначала выполняем тяжелое обновление
                await updateDeviceRegisters(serial, appState.slaveAddress, appState);
                appState.isPolling = true;
            } catch (err) {
                console.error("Ошибка при обновлении:", err);
            } finally {
                // 2. Сбрасываем флаг БЛОКИРОВКИ ДО запуска цикла
                appState.isRefreshing = false;
                refreshBtn.disabled = false;
                
                // 3. Теперь, когда isRefreshing == false, запускаем цикл с правильными 5 параметрами
                console.log("DEBUG: Запускаю readLoop после обновления");
                readLoop(serial, parser, view, buffers, appState);
            }
        });
    }

    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) return;
            
            const oscContainer = document.getElementById('osc-container');
            
            // Если сейчас НЕ опрашиваем, значит кнопка должна ЗАПУСТИТЬ и ПОКАЗАТЬ осциллограф
            const isStarting = !appState.isPolling;
            
            console.log("DEBUG: Кнопка нажата. Будем запускать? =", isStarting);

            if (oscContainer) {
                if (isStarting) {
                    // Принудительно ПОКАЗЫВАЕМ
                    oscContainer.classList.remove('hidden');
                    oscContainer.style.display = 'block';
                    
                    if (view && typeof view.forceResize === 'function') {
                        setTimeout(() => view.forceResize(), 50);
                    }
                } else {
                    // Принудительно СКРЫВАЕМ
                    oscContainer.classList.add('hidden');
                    oscContainer.style.display = 'none';
                }
            }

            appState.isPolling = isStarting;
            if (appState.isPolling) {
                readLoop(serial, parser, view, buffers, appState);
            }
        });
    }

    // 5. Логика выпадающего меню папок
    const actionOpenFile = () => filePicker.click();
    
    if (folderActionBtn) folderActionBtn.addEventListener('click', (e) => { e.stopPropagation(); filePicker.click(); });
    if (menuOpenFile) menuOpenFile.addEventListener('click', () => { actionOpenFile(); folderDropdown?.classList.remove('show'); });
    if (menuOpenFolder) menuOpenFolder.addEventListener('click', () => { folderPicker.click(); folderDropdown?.classList.remove('show'); });
    if (folderArrowBtn) folderArrowBtn.addEventListener('click', (e) => { e.stopPropagation(); folderDropdown?.classList.toggle('show'); });
    
    document.addEventListener('click', () => folderDropdown?.classList.remove('show'));

    console.log("UI Manager: Интерфейс и обработчики инициализированы.");
}