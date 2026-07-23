// js/handlers/readLoop.ts
import { calculateRamRange } from '../oscilloscope/ringBuffer.js';
import { MonitorRow } from '../model/monitorRow.js';
import { MonitorSignal } from '../model/monitorSignal.js';
import { handleValidPacket, RegMapEntry } from './packetHandler.js';
import { serialManager } from '../serial/serialManager.js';

let currentLoopId = 0;

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

export async function readLoop(serial: any, parser: any, view: any, buffers: any[], stateObj: any): Promise<void> {
    console.log("[readLoop] Функция вызвана. stateObj.isPolling:", stateObj.isPolling);
    
    const deviceConfig = stateObj.currentDeviceConfig; 
    if (!deviceConfig?.['RAM']) return;

    const ramSection = deviceConfig['RAM'];
    const keys = Object.keys(ramSection);

    const { start, count } = calculateRamRange(ramSection);
    const loopId = ++currentLoopId; 
    serialManager.init(serial);

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

                let offset = 0;
                if (type !== 'TBit' && parts[8]) {
                    const parsedOffset = parseFloat(parts[8].replace(',', '.'));
                    if (!isNaN(parsedOffset)) offset = parsedOffset;
                }

                let baseMin = 0;
                let baseMax = 100;
                if (parts[9]) {
                    const parsedMin = parseFloat(parts[9].replace(',', '.'));
                    if (!isNaN(parsedMin)) baseMin = parsedMin;
                }
                if (parts[10]) {
                    const parsedMax = parseFloat(parts[10].replace(',', '.'));
                    if (!isNaN(parsedMax)) baseMax = parsedMax;
                }

                const signal: MonitorSignal = {
                    id: key,
                    name: name,
                    description: desc,
                    dataType: type,
                    register: 0,
                    unit: type === 'TBit' ? '—' : (parts[5] || '—'),
                    multiplier: scale,
                    offset: offset,
                    buffer: null as any,
                    currentValue: 0
                };

                const row = new MonitorRow(signal, baseMin, baseMax);
                oscModel.addRow(row);
            }
        });
    }

    if (view && typeof view.setRowTypes === 'function') {
        const types = keys.map(key => ramSection[key] ? ramSection[key][2] : 'TWORD');
        view.setRowTypes(types);
    }

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