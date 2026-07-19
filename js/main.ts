// js/main.ts
import { initUI } from './ui/uiManager.js';
import { setupFileHandling } from './file-loader.js';
import { IniParser } from './iniParser.js';
import { MonitorModel } from './model/monitorModel.js';
import { MonitorRow } from './model/monitorRow.js';
import { MonitorSignal } from './model/monitorSignal.js';
import { RingBuffer } from './oscilloscope/ringBuffer.js';
import { PixiOscilloscope } from './oscilloscope/pixiOscilloscope.js';
import { createOscilloscopeView } from './views/oscilloscopeView.js';
import { updateDeviceRegisters as realUpdateDeviceRegisters } from './serial/device_updater.js';
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

    // === СОЗДАНИЕ ЛЕВОЙ ПАНЕЛИ ОСЦИЛЛОГРАФА ===
    const oscContainer = document.getElementById('osc-container');
    if (oscContainer) {
        oscContainer.innerHTML = '';
        const oscViewElement = createOscilloscopeView();
        oscContainer.appendChild(oscViewElement);
        console.log("✅ DEBUG: Осциллограф (левая панель + графики) добавлен в DOM");
    } else {
        console.error("❌ ERROR: Элемент #osc-container не найден в HTML!");
    }
    // ===========================================

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

    (window as any).initTableResizers = () => {
        const table = document.querySelector('.modbus-grid') as HTMLTableElement;
        if (!table) return;

        const colgroup = table.querySelector('colgroup');
        if (!colgroup) return;
        
        const cols = Array.from(colgroup.querySelectorAll('col'));
        const lastHeaderRow = table.querySelector('thead tr:last-child');
        if (!lastHeaderRow) return;
        
        const headers = lastHeaderRow.querySelectorAll('th') as NodeListOf<HTMLElement>;
        
        table.querySelectorAll('.table-resizer').forEach(el => el.remove());
        
        headers.forEach((th, idx) => {
            if (idx === headers.length - 1) return;
            
            const resizer = document.createElement('div');
            resizer.className = 'table-resizer';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                const startX = e.clientX;
                const startWidthLeft = cols[idx].offsetWidth || 100;
                const startWidthRight = cols[idx + 1].offsetWidth || 100;
                const tableWidth = table.offsetWidth;

                const onMouseMove = (ev: MouseEvent) => {
                    let delta = ev.clientX - startX;
                    if (startWidthLeft + delta < 40) delta = 40 - startWidthLeft;
                    if (startWidthRight - delta < 40) delta = startWidthRight - 40;

                    const pctLeft = ((startWidthLeft + delta) / tableWidth) * 100;
                    const pctRight = ((startWidthRight - delta) / tableWidth) * 100;

                    cols[idx].style.width = `${pctLeft}%`;
                    cols[idx + 1].style.width = `${pctRight}%`;
                };

                const onMouseUp = () => {
                    resizer.classList.remove('active');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                resizer.classList.add('active');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    };

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
        updateDeviceRegisters: realUpdateDeviceRegisters
    });
    
    console.log("✅ main.ts успешно завершен, UI инициализирован.");
});