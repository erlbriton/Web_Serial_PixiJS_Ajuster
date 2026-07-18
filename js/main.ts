// js/main.ts
import { initUI } from './ui/uiManager.js';
import { setupFileHandling } from './file-loader.js';
import { IniParser } from './iniParser.js';
import { MonitorModel } from './model/monitorModel.js';
import { MonitorRow } from './model/monitorRow.js';
import { MonitorSignal } from './model/monitorSignal.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { PixiOscilloscope } from './oscilloscope/pixiOscilloscope.js';
import { 
    serialManager, 
    readLoop as realReadLoop,          
    executeDeviceIdentification as realExecuteId 
} from './serial-actions.js'; 
import { ModbusParser } from './serial/modbus.js'; 

const appState = {
    iniParser: new IniParser(),
    parser: new IniParser(),
    modbusParser: new ModbusParser(),
    currentDeviceConfig: null as any,
    slaveAddress: 1,
    isPolling: false,
    isRefreshing: false
};

document.addEventListener('DOMContentLoaded', () => {
    const initialModel = new MonitorModel();
    const ramParameters = appState.iniParser.getSectionParameters('RAM');
    
    for (const param of ramParameters) {
        const regAddressNum = parseInt(param.regAddress || '0', 10);
        const multiplierStr = param.multiplier ? param.multiplier.replace(',', '.') : '1';
        const multiplierNum = parseFloat(multiplierStr);
        
        const signal: MonitorSignal = {
            id: param.hexAddress || param.name || 'unknown',
            name: param.name || 'unknown',
            description: param.description || '',
            dataType: param.dataType || 'TWORD',
            register: isNaN(regAddressNum) ? 0 : regAddressNum,
            unit: param.unit || '',
            multiplier: isNaN(multiplierNum) ? 1.0 : multiplierNum,
            buffer: new RingBuffer(2500),
            currentValue: 0
        };
        
        const row = new MonitorRow(signal);
        row.visible = true;
        row.height = 20;
        initialModel.addRow(row);
    }
    
    (window as any).oscModel = initialModel;
    console.log(`✅ DEBUG: Начальная MonitorModel создана. Строк: ${initialModel.rowCount}`);

    let canvasContainer = document.getElementById('osc-canvas-container');
    if (!canvasContainer) {
        canvasContainer = document.createElement('div');
        canvasContainer.id = 'osc-canvas-container';
        const graphWrapper = document.querySelector('.osc-graph-wrapper');
        const oscContainer = document.getElementById('osc-container');
        if (graphWrapper) graphWrapper.appendChild(canvasContainer);
        else if (oscContainer) oscContainer.appendChild(canvasContainer);
        else document.body.appendChild(canvasContainer);
    }

    const view = new PixiOscilloscope('osc-canvas-container', initialModel);
    (window as any).oscView = view;
    const tempBuffers = initialModel.rows.map(row => row.signal.buffer);

    const fileInput = document.getElementById('ini-file-input') as HTMLInputElement;
    if (fileInput) {
        setupFileHandling(fileInput, appState, view, tempBuffers);
    }

    const rawSerial = (navigator as any).serial;
    const serialAdapter = {
        port: null as any, reader: null as any, writer: null as any,
        async connect(baudRate: number) {
            if (!rawSerial) throw new Error("Web Serial API не поддерживается");
            this.port = await rawSerial.requestPort();
            await this.port.open({ baudRate });
            this.writer = this.port.writable?.getWriter();
        },
        async write(data: Uint8Array) {
            if (!this.writer) throw new Error("Порт не открыт");
            await this.writer.write(data);
        },
        async readChunk(): Promise<Uint8Array> {
            if (!this.port || !this.port.readable) throw new Error("Port not readable");
            if (!this.reader) this.reader = this.port.readable.getReader();
            try {
                const { value, done } = await this.reader.read();
                if (done) { this.reader.releaseLock(); this.reader = null; throw new Error("Stream done"); }
                return value || new Uint8Array(0);
            } catch (e) {
                if (this.reader) { this.reader.releaseLock(); this.reader = null; }
                throw e;
            }
        },
        get isConnected() { return this.port !== null && this.port.readable !== null; },
        getInfo() { return this.port ? this.port.getInfo() : {}; }
    };

        // ==========================================
    // ПУЛЕНЕПРОБИВАЕМЫЙ РЕСАЙЗ ПРАВОЙ ТАБЛИЦЫ (.modbus-grid)
    // ==========================================
    (window as any).initTableResizers = () => {
        // 1. Чистим старые ресайзеры ТОЛЬКО в правой таблице
        document.querySelectorAll('.modbus-grid .table-resizer').forEach(el => el.remove());

        // 2. Находим правую таблицу
        const table = document.querySelector('.modbus-grid') as HTMLTableElement;
        if (!table) {
            console.warn("⚠️ Таблица .modbus-grid не найдена!");
            return;
        }

        // 3. Принудительно задаем таблице правильные свойства для ресайза
        table.style.setProperty('table-layout', 'fixed', 'important');
        table.style.setProperty('width', 'auto', 'important'); // Позволяет таблице расширяться
        table.style.setProperty('min-width', '100%', 'important');

        // 4. Находим последнюю строку в thead (там находятся нужные нам заголовки колонок)
        const thead = table.querySelector('thead');
        if (!thead) return;
        
        const headerRows = thead.querySelectorAll('tr');
        const targetHeaderRow = headerRows[headerRows.length - 1]; 
        const headers = targetHeaderRow.querySelectorAll('th') as NodeListOf<HTMLElement>;

        headers.forEach((th, idx) => {
            // Не добавляем ресайзер на самую последнюю колонку
            if (idx === headers.length - 1) return;

            const resizer = document.createElement('div');
            resizer.className = 'table-resizer';
            
            // Гарантируем, что у заголовка правильное позиционирование для ресайзера
            th.style.position = 'relative';
            th.appendChild(resizer);

            let startX = 0;
            let startWidth = 0;

            const onMouseDown = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                startX = e.clientX;
                startWidth = th.offsetWidth;
                
                resizer.classList.add('active');
                document.body.classList.add('is-resizing');
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            const onMouseMove = (e: MouseEvent) => {
                const delta = e.clientX - startX;
                const newWidth = Math.max(40, startWidth + delta); // Минимум 40px

                // А. Меняем ширину заголовка с максимальным приоритетом
                th.style.setProperty('width', `${newWidth}px`, 'important');
                th.style.setProperty('min-width', `${newWidth}px`, 'important');
                th.style.setProperty('max-width', `${newWidth}px`, 'important');

                // Б. Меняем ширину ВСЕХ ячеек (td) в этом столбце с максимальным приоритетом
                const rows = table.rows;
                for (let i = 1; i < rows.length; i++) { // начинаем с 1, чтобы пропустить thead
                    const cell = rows[i].cells[idx];
                    if (cell) {
                        cell.style.setProperty('width', `${newWidth}px`, 'important');
                        cell.style.setProperty('min-width', `${newWidth}px`, 'important');
                        cell.style.setProperty('max-width', `${newWidth}px`, 'important');
                    }
                }
            };

            const onMouseUp = () => {
                resizer.classList.remove('active');
                document.body.classList.remove('is-resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            resizer.addEventListener('mousedown', onMouseDown);
        });
        console.log(`✅ Ресайзеры правой таблицы (.modbus-grid) инициализированы. Найдено колонок: ${headers.length}`);
    };
    // ==========================================

    initUI({
        serial: serialAdapter,
        appState, 
        parser: appState.modbusParser, 
        view, 
        buffers: tempBuffers, 
        setupFileHandling, 
        updateComInterfaceName: () => undefined, 
        executeDeviceIdentification: realExecuteId, 
        readLoop: realReadLoop, 
        showIdModal: (msg: string) => alert(msg), 
        updateDeviceRegisters: async () => false
    });
    
    console.log("✅ main.ts успешно завершен, UI инициализирован.");
});