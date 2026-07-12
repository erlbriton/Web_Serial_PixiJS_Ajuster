// js/serial/device_updater.ts
import { updateRowValues } from "../ini-manager/tree-ui.js";
import { hexToFloat32, float32ToHex } from "../ini-manager/tree-core.js";
import { calculateCRC, serialManager } from "../serial-actions.js";
import { SerialConnection } from "./serial.js";

interface AppState {
    parser: any;
    isPolling: boolean;
    multiplierCache?: any;
    currentDeviceConfig?: any;
}

function getScaleFromCache(appState: AppState | null, section: string, key: string): number {
    const cache = appState?.parser?.multiplierCache;

    if (!cache) {
        console.warn("DEBUG: Cache is undefined in appState");
        return 1.0;
    }

    if (cache[section] && cache[section][key] !== undefined) {
        const val = parseFloat(cache[section][key].replace(",", "."));
        return isNaN(val) ? 1.0 : val;
    }

    return 1.0;
}

let isUpdating = false;

export async function updateDeviceRegisters(
    serial: SerialConnection,
    slaveAddress: number = 0x01,
    appState: AppState | null = null,
): Promise<boolean> {
    if (isUpdating) return false;

    isUpdating = true;
    document.body.classList.add("loading-state");

    const wasPolling = appState ? appState.isPolling : false;

    if (wasPolling && appState) {
        appState.isPolling = false;
        await new Promise((r) => setTimeout(r, 20));
    }

    try {
        const rows = Array.from(document.querySelectorAll("#grid-data-rows tr")) as HTMLTableRowElement[];
        const registerMap = new Map<number, HTMLTableRowElement[]>();
        const addresses: number[] = [];

        for (const tr of rows) {
            const addrStr = tr.getAttribute("data-reg");
            if (!addrStr) continue;
            const addr = parseInt(addrStr, 16);

            if (!registerMap.has(addr)) {
                registerMap.set(addr, []);
            }
            registerMap.get(addr)!.push(tr);

            const dataType = tr.getAttribute("data-type");
            if (dataType === "TFloat" || dataType === "TDWORD") {
                addresses.push(addr, addr + 1);
            } else {
                addresses.push(addr);
            }
        }

        // ... (остальной код обработки batches остается таким же, 
        // убедитесь что для reply и других переменных TS понимает типы)
        
        // Внутри цикла обработки reply добавьте приведение:
        // const tr = tr_node as HTMLTableRowElement;
        
        // ... (остальной код)
    } finally {
        isUpdating = false;
        document.body.classList.remove("loading-state");
    }
    return wasPolling;
}