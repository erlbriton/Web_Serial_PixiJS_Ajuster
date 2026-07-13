// js/ui/uiManager.ts
import { createOscilloscopeView } from '../views/oscilloscopeView.js';

interface UIDependencies {
    serial: any;
    appState: any;
    parser: any;
    view: any;
    buffers: any;
    setupFileHandling: (picker: HTMLInputElement, state: any) => void;
    setupFolderHandling?: (picker: HTMLInputElement) => void; // Сделали опциональным, т.к. в main.ts его нет
    updateComInterfaceName: (serial: any, select: HTMLSelectElement | null) => string | undefined; // Исправлено
    executeDeviceIdentification: (serial: any, select: HTMLSelectElement | null, state: any) => Promise<void>;
    readLoop: (serial: any, parser: any, view: any, buffers: any, state: any) => void;
    showIdModal: (msg: string) => void;
    updateDeviceRegisters: (serial: any, addr: number, state: any) => Promise<boolean>; // Исправлено
}

export function initUI(deps: UIDependencies): void {
    const { 
        serial, appState, parser, view, buffers, 
        setupFileHandling, setupFolderHandling, updateComInterfaceName,
        executeDeviceIdentification, readLoop, showIdModal, updateDeviceRegisters 
    } = deps;

    // DOM Элементы
    const filePicker = document.getElementById('filePicker') as HTMLInputElement | null;
    const folderPicker = document.getElementById('folderPicker') as HTMLInputElement | null;
    const idBtn = document.getElementById("idBtn") as HTMLButtonElement | null;
    const connectBtn = document.getElementById("connectBtn") as HTMLButtonElement | null;
    const comSelect = document.getElementById("comSelect") as HTMLSelectElement | null;
    const toggleOscBtn = document.getElementById('toggleOscBtn') as HTMLButtonElement | null;
    const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement | null;
    const folderActionBtn = document.getElementById('folderActionBtn') as HTMLElement | null;
    const folderArrowBtn = document.getElementById('folderArrowBtn') as HTMLElement | null;
    const folderDropdown = document.getElementById('folderDropdown') as HTMLElement | null;
    const menuOpenFile = document.getElementById('menuOpenFile') as HTMLElement | null;
    const menuOpenFolder = document.getElementById('menuOpenFolder') as HTMLElement | null;

    // 3. Инициализация логики файлов
    if (filePicker) setupFileHandling(filePicker, appState);
    if (folderPicker && typeof setupFolderHandling === 'function') setupFolderHandling(folderPicker);

    // 4. События кнопок
    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            if (serial.isConnected) { showIdModal("Порт уже открыт!"); return; }
            try {
                await serial.connect(115200);
                const chipName = updateComInterfaceName(serial, comSelect) || "Неизвестное устройство"; // Обрабатываем undefined
                console.log(`Успешно подключено к: ${chipName}`);
            } catch (err: any) { showIdModal("Ошибка: " + err.message); }
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
        if (appState.isRefreshing) { console.log("Обновление уже идет, игнорирую клик"); return; }
        
        console.log("--- Клик по Обновить ---");
        appState.isRefreshing = true;
        refreshBtn.disabled = true;
        
        // Создаем переменную здесь, чтобы она была видна в finally
        let wasPolling = false;

        try {
            wasPolling = await updateDeviceRegisters(serial, appState.slaveAddress, appState);
            console.log("Обновление завершено. Был ли опрос активен:", wasPolling);
        } catch (err) {
            console.error("Критическая ошибка при обновлении:", err);
        } finally {
            // Сначала сбрасываем все флаги состояния
            appState.isRefreshing = false;
            refreshBtn.disabled = false;
            console.log("--- Кнопка снова активна ---");

            // И только теперь, когда флаг isRefreshing гарантированно false, запускаем опрос
            if (wasPolling) {
                console.log("Запускаю readLoop после обновления...");
                appState.isPolling = true;
                readLoop(serial, parser, view, buffers, appState);
            }
        }
    });
}
    
    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) return;
            
            const oscContainer = document.getElementById('osc-container');
            const isStarting = !appState.isPolling;
            
            if (oscContainer) {
                if (isStarting) {
                    oscContainer.classList.remove('hidden');
                    oscContainer.style.display = 'block';
                    if (view && typeof view.forceResize === 'function') {
                        setTimeout(() => view.forceResize(), 50);
                    }
                } else {
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
    const actionOpenFile = () => filePicker?.click();
    
    if (folderActionBtn && filePicker) folderActionBtn.addEventListener('click', (e) => { e.stopPropagation(); filePicker.click(); });
    if (menuOpenFile && filePicker) menuOpenFile.addEventListener('click', () => { actionOpenFile(); folderDropdown?.classList.remove('show'); });
    if (menuOpenFolder && folderPicker) menuOpenFolder.addEventListener('click', () => { folderPicker.click(); folderDropdown?.classList.remove('show'); });
    if (folderArrowBtn) folderArrowBtn.addEventListener('click', (e) => { e.stopPropagation(); folderDropdown?.classList.toggle('show'); });
    
    document.addEventListener('click', () => folderDropdown?.classList.remove('show'));

    console.log("UI Manager: Интерфейс и обработчики инициализированы.");
}