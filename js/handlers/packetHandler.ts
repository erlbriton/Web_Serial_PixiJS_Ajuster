// js/handlers/packetHandler.ts

let lastUiUpdateTime = 0;

export interface RegMapEntry {
    regAddress: number;
    bitOffset: number;
    type: string;
    name: string;
    unit: string;
    scale: number;
    decimals: number;
    offset: number;
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

export function handleValidPacket(
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
        const row = oscModel?.rows?.[i];
        const sig = row?.signal;
        
        if (mapEntry && sig) {
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

            const effectiveScale = sig.multiplier;

            if (sig._lastEffectiveScale === undefined) {
                sig._lastEffectiveScale = effectiveScale;
            } else if (sig._lastEffectiveScale !== effectiveScale) {
                sig._lastEffectiveScale = effectiveScale;
                const buf = sig.buffer || buffers[i];
                if (buf) {
                    if (typeof buf.clear === 'function') {
                        buf.clear();
                    } else if (typeof buf.reset === 'function') {
                        buf.reset();
                    } else if (Array.isArray(buf)) {
                        buf.length = 0;
                    }
                }
            }

            const physicalValue = mapEntry.type === 'TBit'
                ? finalValue
                : finalValue * effectiveScale + (sig.offset ?? 0);

            sig.currentValue = physicalValue;

            const buf = sig.buffer || buffers[i];
            if (buf && typeof buf.push === 'function') {
                buf.push(physicalValue);
            } else if (Array.isArray(buf)) {
                buf.push(physicalValue);
            }

            if (row.scale) {
                if (row.scale.auto) {
                    let data: number[] = [];
                    if (buf && typeof buf.getLinearData === 'function') {
                        data = buf.getLinearData();
                    } else if (Array.isArray(buf)) {
                        data = buf;
                    }

                    let min = Infinity;
                    let max = -Infinity;

                    for (let k = 0; k < data.length; k++) {
                        const v = data[k];
                        if (v !== undefined && v !== null && !isNaN(v)) {
                            if (v < min) min = v;
                            if (v > max) max = v;
                        }
                    }

                    if (min !== Infinity && max !== -Infinity) {
                        if (typeof row.scale.updateAuto === 'function') {
                            row.scale.updateAuto(min, max);
                        } else {
                            if (min === max) { min -= 1; max += 1; }
                            const span = max - min;
                            row.scale.displayMin = min - span * 0.05;
                            row.scale.displayMax = max + span * 0.05;
                        }
                    }
                } else {
                    if (typeof row.scale.updateManual === 'function') {
                        row.scale.updateManual();
                    }
                }
            }

            const indEl = document.getElementById(`osc-ind-${i}`);
            if (indEl) {
                indEl.textContent = finalValue === 1 ? 'I' : 'O';
            }

            if (shouldUpdateUiText) {
                let hexString = '';
                if (mapEntry.type === 'TBit') {
                    hexString = '0x' + finalValue.toString(16).toUpperCase();
                } else {
                    hexString = '0x' + rawValue.toString(16).toUpperCase().padStart(4, '0');
                }

                const formattedPhysical = mapEntry.type === 'TBit' 
                    ? physicalValue.toString() 
                    : physicalValue.toFixed(mapEntry.decimals ?? 2);

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