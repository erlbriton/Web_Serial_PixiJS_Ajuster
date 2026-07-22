// js/serial-actions.ts
import { identifyUsbChip } from './usb.js';
import { showIdModal, updateIdBanner, closeIdModal } from './ui.js';
import { calculateRamRange } from './oscilloscope/ringBuffer.js';
import { MonitorRow } from './model/monitorRow.js';
import { MonitorSignal } from './model/monitorSignal.js';

let currentLoopId = 0; 
let lastUiUpdateTime = 0; // Время последнего обновления текстовых полей в UI

class SerialManager {
    private serial: any = null;
    private readerPromise: Promise<void> | null = null;
    public currentHandler: ((chunk: Uint8Array) => void) | null = null;
    private lock: Promise<void> = Promise.resolve();

    init(serial: any): void {
        this.serial = serial;
        this.startReader();
    }

    private startReader(): void {
        if (this.readerPromise || !this.serial || !this.serial.isConnected) return;
        
        this.readerPromise = (async () => {
            console.log("[SerialManager] Центральный единый ридер успешно запущен.");
            while (this.serial && this.serial.isConnected) {
                try {
                    const chunk = await this.serial.readChunk();
                    if (chunk && chunk.length > 0) {
                        this.currentHandler?.(chunk);
                    } else {
                        await new Promise(r => setTimeout(r, 5));
                    }
                } catch (e) {
                    console.error("[SerialManager] Критическая ошибка:", e);
                    break;
                }
            }
            this.readerPromise = null;
        })();
    }

    async executeTransaction(packet: Uint8Array, checkCompleteFn: (buf: Uint8Array) => boolean, timeoutMs = 1000): Promise<Uint8Array> {
        const oldLock = this.lock;
        let release!: () => void;
        this.lock = new Promise(r => release = r);
        await oldLock;

        try {
            this.startReader();
            await this.serial.write(packet);

            return await new Promise((resolve) => {
                let buffer = new Uint8Array(0);
                let timeoutId: any = null;

                const cleanUp = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (this.currentHandler === handleChunk) this.currentHandler = null;
                };

                const handleChunk = (chunk: Uint8Array) => {
                    let newBuffer = new Uint8Array(buffer.length + chunk.length);
                    newBuffer.set(buffer);
                    newBuffer.set(chunk, buffer.length);
                    buffer = newBuffer;

                    if (checkCompleteFn(buffer)) {
                        cleanUp();
                        resolve(buffer);
                    }
                };

                this.currentHandler = handleChunk;
                timeoutId = setTimeout(() => { cleanUp(); resolve(buffer); }, timeoutMs);
            });
        } finally {
            release();
        }
    }
}

export const serialManager = new SerialManager();

export function calculateCRC(buffer: Uint8Array): number {
    let crc = 0xFFFF;
    for (let pos = 0; pos < buffer.length; pos++) {
        crc ^= buffer[pos];
        for (let i = 8; i !== 0; i--) {
            if ((crc & 0x0001) !== 0) {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

export function updateComInterfaceName(serial: any, comSelect: HTMLSelectElement | null): string | undefined {
    if (!comSelect) return;
    const portInfo = (serial.port?.getInfo?.()) || (typeof serial.getInfo === 'function' ? serial.getInfo() : {});
    const chipName = identifyUsbChip(portInfo);
    comSelect.innerHTML = `<option value="active">${chipName}</option>`;
    comSelect.className = 'select-blue';
    return chipName;
}

export async function executeDeviceIdentification(serial: any, comSelect: HTMLSelectElement | null, stateObj: any): Promise<void> {
    try {
        stateObj.isIdentifying = true; 
        await serial.connect(115200);
        serialManager.init(serial);
        
        updateComInterfaceName(serial, comSelect);
        await new Promise(r => setTimeout(r, 500));
        showIdModal("Запрос ID устройства...");
        
        const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x2C]);
        const checkComplete = (buf: Uint8Array) => buf.length >= 3 && buf.length >= 3 + buf[2] + 2;

        const reply = await serialManager.executeTransaction(packet, checkComplete, 1500);

        if (reply && reply.length >= 3) {
            let idText = Array.from(reply.slice(3, 3 + reply[2]))
                .map(b => b >= 32 ? String.fromCharCode(b) : "").join("");
            updateIdBanner(idText.trim());
            closeIdModal();
        } else {
            showIdModal("Ошибка: Нет ответа");
        }
    } catch (error: any) {
        showIdModal("Ошибка: " + error.message);
    } finally {
        stateObj.isIdentifying = false; 
    }
}

interface RegMapEntry {
    regAddress: number;
    bitOffset: number;
    type: string;
    name: string;
    unit: string;
    scale: number;
    decimals: number;
    offset: number;
}

export async function readLoop(serial: any, parser: any, view: any, buffers: any[], stateObj: any): Promise<void> {
    console.log("[readLoop] Функция вызвана. stateObj.isPolling:", stateObj.isPolling);
    
    const deviceConfig = stateObj.currentDeviceConfig; 
    if (!deviceConfig?.['RAM']) return;

    const ramSection = deviceConfig['RAM'];
    const keys = Object.keys(ramSection);

    const { start, count } = calculateRamRange(ramSection);
    const loopId = ++currentLoopId; 
    serialManager.init(serial);

    // Архитектурно правильная инициализация модели строк графиков (предотвращает undefined)
    const oscModel = (window as any).oscModel;
    if (oscModel && typeof oscModel.clear === 'function') {
        oscModel.clear();
        keys.forEach((key) => {
            const parts = ramSection[key];
            if (parts) {
                const name = parts[0] || key;
                const desc = parts[1] || name;
                const type = parts[2] || 'TWORD';
                
                let scale = 1;
                if (type !== 'TBit' && parts[6]) {
                    const parsedScale = parseFloat(parts[6].replace(',', '.'));
                    if (!isNaN(parsedScale)) scale = parsedScale;
                }

                const signal: MonitorSignal = {
                    id: key,
                    name: name,
                    description: desc,
                    dataType: type,
                    register: 0,
                    unit: type === 'TBit' ? '—' : (parts[5] || '—'),
                    multiplier: scale,
                    buffer: null as any,
                    currentValue: 0,
                    min: 0,
                    max: 100,
                    autoScale: false
                };

                const row = new MonitorRow(signal);
                oscModel.addRow(row);
            }
        });
    }

    if (view && typeof view.setRowTypes === 'function') {
        const types = keys.map(key => ramSection[key] ? ramSection[key][2] : 'TWORD');
        view.setRowTypes(types);
    }

    // 1. Однократное заполнение статических колонок Name и Unit главной таблицы параметров
    keys.forEach((key, i) => {
        const parts = ramSection[key];
        if (parts) {
            const type = parts[2];
            const name = parts[0] || ''; 
            const unit = type === 'TBit' ? '—' : (parts[5] || '—');

            const nameEl = document.getElementById(`param-name-${i}`);
            if (nameEl) nameEl.textContent = name;

            const unitEl = document.getElementById(`param-unit-${i}`);
            if (unitEl) unitEl.textContent = unit;
        }
    });

    // 2. Автоматическая генерация строк таблицы осциллографа
    const oscTbody = document.querySelector('.osc-data-grid tbody');
    if (oscTbody) {
        let oscHtml = '';
        keys.forEach((key, i) => {
            const parts = ramSection[key];
            if (parts) {
                const type = parts[2];
                const name = parts[0] || ''; 
                const desc = parts[1] || parts[0] || ''; 
                const unit = type === 'TBit' ? '—' : (parts[5] || '—');
                const displayUnit = (type === 'TBit') ? '.' : (unit === '*' ? '—' : unit);

                oscHtml += `
                    <tr title="${desc}">
                        <td class="param-name" title="${desc}">
                            <div id="osc-name-${i}" class="osc-cell-text">${name}</div>
                        </td>
                        <td>
                            <div id="osc-hex-${i}" class="osc-cell-text">—</div>
                        </td>
                        <td>
                            <div id="osc-phys-${i}" class="osc-cell-text">—</div>
                        </td>
                        <td>
                            <div id="osc-unit-${i}" class="osc-cell-text">${displayUnit}</div>
                        </td>
                    </tr>
                `;
            }
        });
        oscTbody.innerHTML = oscHtml;
    }

    // 3. Строим точную карту параметров
    const regMap: (RegMapEntry | null)[] = keys.map(key => {
        if (key && ramSection[key]) {
            const parts = ramSection[key];
            const type = parts[2];     
            const regStr = type === 'TBit' ? parts[5] : parts[4];
            
            if (regStr) {
                const match = regStr.trim().match(/^r([0-9a-fA-F]+)(?:\.([0-9a-fA-F]+))?$/i);
                if (match) {
                    const regAddress = parseInt(match[1], 16); 
                    const bitOffset = match[2] !== undefined ? parseInt(match[2], 16) : 0;
                    
                    const name = parts[0] || ''; 
                    const unit = type === 'TBit' ? '—' : (parts[5] || '—');

                    let scale = 1;
                    if (type !== 'TBit' && parts[6]) {
                        const parsedScale = parseFloat(parts[6].replace(',', '.'));
                        if (!isNaN(parsedScale)) scale = parsedScale;
                    }

                    let decimals = 0;
                    if (type !== 'TBit' && parts[7]) {
                        const parsedDecimals = parseInt(parts[7], 10);
                        if (!isNaN(parsedDecimals)) decimals = parsedDecimals;
                    }

                    let offset = 0;
                    if (type !== 'TBit' && parts[8]) {
                        const parsedOffset = parseFloat(parts[8].replace(',', '.'));
                        if (!isNaN(parsedOffset)) offset = parsedOffset;
                    }

                    return { regAddress, bitOffset, type, name, unit, scale, decimals, offset };
                }
            }
        }
        return null;
    });

    while (serial.isConnected && stateObj.isPolling && !stateObj.isRefreshing) {
        if (loopId !== currentLoopId) return; 

        const body = new Uint8Array([
            stateObj.slaveAddress, 0x03, 
            (start >> 8) & 0xFF, start & 0xFF, 
            (count >> 8) & 0xFF, count & 0xFF 
        ]);
        
        const crc = calculateCRC(body);
        const finalPacket = new Uint8Array([ ...body, crc & 0xFF, (crc >> 8) & 0xFF ]);

        try {
            const reply = await serialManager.executeTransaction(finalPacket, (buf) => buf.length >= 3 + (count * 2) + 2, 100);
            
            if (loopId !== currentLoopId || !stateObj.isPolling || stateObj.isRefreshing) break; 
            
            if (reply?.length > 0) {
                parser.appendData(reply);
                let packetData = parser.parsePacket();
                while (packetData !== null) {
                    if (packetData.length >= count) {
                        handleValidPacket(packetData, view, buffers, regMap, start);
                    }
                    packetData = parser.parsePacket();
                }
            }
        } catch (err) { console.error(err); }
        await new Promise(res => setTimeout(res, 20));
    }
}

function decodeSignedInt16(val: number): number {
    return val >= 0x8000 ? val - 0x10000 : val;
}

function decodeFloat(reg1: number, reg2: number): number {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint16(0, reg1, false);
    view.setUint16(2, reg2, false);
    const floatVal = view.getFloat32(0, false);
    return isNaN(floatVal) || !isFinite(floatVal) ? 0 : floatVal;
}

function handleValidPacket(
    packetData: number[], 
    view: any, 
    buffers: any[], 
    regMap: (RegMapEntry | null)[], 
    startReg: number
): void {
    const now = performance.now();
    const shouldUpdateUiText = (now - lastUiUpdateTime) >= 100;
    if (shouldUpdateUiText) {
        lastUiUpdateTime = now;
    }

    const oscModel = (window as any).oscModel;

    for (let i = 0; i < buffers.length; i++) {
        const mapEntry = regMap[i];
        
        if (mapEntry) {
            const index = mapEntry.regAddress - startReg;
            const rawValue = packetData[index] !== undefined ? packetData[index] : 0;

            let finalValue = rawValue;

            if (mapEntry.type === 'TBit') {
                finalValue = (rawValue >> mapEntry.bitOffset) & 1;
            } else if (mapEntry.type === 'TInteger') {
                finalValue = decodeSignedInt16(rawValue);
            } else if (mapEntry.type === 'TFloat') {
                const nextWord = packetData[index + 1] !== undefined ? packetData[index + 1] : 0;
                finalValue = decodeFloat(rawValue, nextWord);
            }

            // Извлекаем текущую шкалу
            const row = oscModel?.rows?.[i];
            const sig = row?.signal;
            const userScale = sig?.multiplier;
            const effectiveScale = (typeof userScale === 'number' && !isNaN(userScale)) ? userScale : mapEntry.scale;

            // 1. Инициализация базовых лимитов (если еще не заданы)
            if (sig) {
                if (sig._baseMax === undefined && typeof sig.max === 'number') sig._baseMax = sig.max;
                if (sig._baseMin === undefined && typeof sig.min === 'number') {
                    sig._baseMin = sig.min;
                    if ((mapEntry.type === 'TInteger' || mapEntry.type === 'TFloat') && sig._baseMin >= 0) {
                        const maxVal = sig._baseMax !== undefined ? sig._baseMax : 100;
                        sig._baseMin = maxVal > 0 ? -maxVal : -100;
                    }
                }
                if (row) {
                    if (row._baseMax === undefined && typeof row.max === 'number') row._baseMax = row.max;
                    if (row._baseMin === undefined && typeof row.min === 'number') {
                        row._baseMin = row.min;
                        if ((mapEntry.type === 'TInteger' || mapEntry.type === 'TFloat') && row._baseMin >= 0) {
                            const maxVal = row._baseMax !== undefined ? row._baseMax : 100;
                            row._baseMin = maxVal > 0 ? -maxVal : -100;
                        }
                    }
                }
            }

            // 2. Рассчитываем текущее физическое значение
            let physicalValue = finalValue;
            if (mapEntry.type !== 'TBit') {
                physicalValue = finalValue * effectiveScale + mapEntry.offset;
            }

            // 3. Помещаем в буфер честное физическое значение (история не искажается масштабом!)
            buffers[i]?.push(physicalValue);

            // 4. Расчет и установка лимитов графика
            if (sig) {
                const isAutoScale = Boolean(sig.autoScale || row?.autoScale);
                const iniScale = mapEntry.scale !== 0 ? mapEntry.scale : 1;
                const scaleFactor = effectiveScale / iniScale;

                if (isAutoScale) {
                    // АВТОМАСШТАБИРОВАНИЕ: честный расчет min/max по всему буферу
                    const buf = buffers[i];
                    if (buf && buf.length > 0) {
                        let minVal = Infinity;
                        let maxVal = -Infinity;
                        let hasValidData = false;
                        
                        for (let k = 0; k < buf.length; k++) {
                            const v = buf[k];
                            if (v !== undefined && v !== null && !isNaN(v)) {
                                hasValidData = true;
                                if (v < minVal) minVal = v;
                                if (v > maxVal) maxVal = v;
                            }
                        }
                        
                        if (hasValidData && minVal !== Infinity && maxVal !== -Infinity) {
                            if (minVal === maxVal) {
                                minVal -= 1;
                                maxVal += 1;
                            } else {
                                const span = maxVal - minVal;
                                minVal -= span * 0.05;
                                maxVal += span * 0.05;
                            }
                            
                            sig.min = minVal;
                            sig.max = maxVal;
                            if (row) {
                                row.min = minVal;
                                row.max = maxVal;
                            }
                        }
                    }
                } else {
                    // РУЧНОЙ РЕЖИМ
                    if (sig._baseMax !== undefined) sig.max = sig._baseMax * scaleFactor;
                    if (sig._baseMin !== undefined) sig.min = sig._baseMin * scaleFactor;
                    if (row && row._baseMax !== undefined) row.max = row._baseMax * scaleFactor;
                    if (row && row._baseMin !== undefined) row.min = row._baseMin * scaleFactor;

                    // Автоматическое расширение границ в ручном режиме, если значение вышло за рамки
                    if (physicalValue < sig.min) {
                        sig.min = physicalValue - (Math.abs(physicalValue) * 0.05 + 0.1);
                        if (sig._baseMin !== undefined && scaleFactor !== 0) {
                            sig._baseMin = sig.min / scaleFactor;
                        }
                        if (row) {
                            row.min = sig.min;
                            if (row._baseMin !== undefined && scaleFactor !== 0) {
                                row._baseMin = sig.min / scaleFactor;
                            }
                        }
                    }
                    if (physicalValue > sig.max) {
                        sig.max = physicalValue + (Math.abs(physicalValue) * 0.05 + 0.1);
                        if (sig._baseMax !== undefined && scaleFactor !== 0) {
                            sig._baseMax = sig.max / scaleFactor;
                        }
                        if (row) {
                            row.max = sig.max;
                            if (row._baseMax !== undefined && scaleFactor !== 0) {
                                row._baseMax = sig.max / scaleFactor;
                            }
                        }
                    }
                }
            }

            // Обновляем индикатор для дискретных значений
            const indEl = document.getElementById(`osc-ind-${i}`);
            if (indEl) {
                indEl.textContent = finalValue === 1 ? 'I' : 'O';
            }

            // Обновляем currentValue в модели
            if (sig) {
                sig.currentValue = physicalValue;
            }

            // Обновление UI текстовых полей
            if (shouldUpdateUiText) {
                let hexString = '';

                if (mapEntry.type === 'TBit') {
                    hexString = '0x' + finalValue.toString(16).toUpperCase();
                } else {
                    hexString = '0x' + rawValue.toString(16).toUpperCase().padStart(4, '0');
                }

                const formattedPhysical = mapEntry.type === 'TBit' 
                    ? physicalValue.toString() 
                    : physicalValue.toFixed(mapEntry.decimals);

                const oscHexEl = document.getElementById(`osc-hex-${i}`);
                if (oscHexEl) {
                    if (mapEntry.type === 'TBit') {
                        oscHexEl.innerHTML = `<div id="osc-ind-${i}" class="discrete-indicator">${finalValue === 1 ? 'I' : 'O'}</div>`;
                    } else {
                        oscHexEl.textContent = hexString;
                    }
                }

                const oscPhysEl = document.getElementById(`osc-phys-${i}`);
                if (oscPhysEl) {
                    oscPhysEl.textContent = mapEntry.type === 'TBit' ? '' : formattedPhysical;
                }
            }
        } else {
            buffers[i]?.push(0);
        }
    }
    view.draw(buffers); 
}