// js/ui/uiManager.js
import { createOscilloscopeView } from '../views/oscilloscopeView.js';

export function initUI(deps) {
    const { 
        serial, appState, parser, view, buffers, 
        setupFileHandling, setupFolderHandling, updateComInterfaceName,
        executeDeviceIdentification, readLoop, showIdModal, updateDeviceRegisters 
    } = deps;

    // 1. Внедрение компонента Monitor
    const oscContainer = document.getElementById('osc-container');
    if (oscContainer) {
        oscContainer.appendChild(createOscilloscopeView());
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
            appState.isRefreshing = true;
            refreshBtn.disabled = true;
            try {
                const wasPolling = await updateDeviceRegisters(serial, appState.slaveAddress, appState);
                if (wasPolling) {
                    appState.isPolling = true;
                    readLoop(serial, parser, view, buffers, appState);
                }
            } finally {
                appState.isRefreshing = false;
                refreshBtn.disabled = false;
            }
        });
    }

    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) return;
            appState.isPolling = !appState.isPolling;
            if (appState.isPolling) readLoop(serial, parser, view, buffers, appState);
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