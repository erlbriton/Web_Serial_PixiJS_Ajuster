// js/ini-manager/tree-core.ts

// Описываем структуру конфигурации, насколько мы ее знаем
export interface DeviceConfig {
    [key: string]: any;
    DEVICE?: {
        Location?: string;
        ID?: string;
        Id?: string;
        id?: string;
        Version?: string;
        Date?: string;
    };
}

export interface RegistryItem {
    id: string;
    displayText: string;
    fullConfig: DeviceConfig;
}

export const deviceRegistry: Record<string, RegistryItem[]> = {};
export let currentDeviceConfig: DeviceConfig | null = null;

export function setCurrentDeviceConfig(config: DeviceConfig | null): void {
    currentDeviceConfig = config;
}

interface RegisterAddress {
    reg: number | null;
    sub: string | null;
}

export function parseRegisterAddress(addrString: string): RegisterAddress {
    if (!addrString || addrString === '*') return { reg: null, sub: null };
    const cleanStr = addrString.toLowerCase().replace('r', '');
    const parts = cleanStr.split('.');
    return {
        reg: parseInt(parts[0], 16),
        sub: parts[1] ? parts[1].toUpperCase() : null
    };
}

export function hexToFloat32(hexStr: string): number {
    if (!hexStr) return NaN;
    const intVal = parseInt(hexStr.replace(/^x/, ''), 16);
    if (isNaN(intVal)) return NaN;
    
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, intVal, false);
    return view.getFloat32(0, false);
}

export function float32ToHex(floatVal: number, padLen: number = 8): string {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, floatVal, false);
    const intVal = view.getUint32(0, false);
    return 'x' + intVal.toString(16).toUpperCase().padStart(padLen, '0');
}

export function addDeviceToRegistry(config: DeviceConfig): boolean {
    if (!config || !config['DEVICE']) return false;
    
    const dev = config['DEVICE'];
    const location = dev['Location'] || 'Неизвестное место';
    const id = dev['ID'] || dev['Id'] || dev['id'] || 'Без ID';
    const version = dev['Version'] || ''; 
    const date = dev['Date'] || '';
    
    const displayComponents = [id, version, date].filter(Boolean);
    const deviceDisplayText = displayComponents.join(' ');

    if (!deviceRegistry[location]) {
        deviceRegistry[location] = [];
    }
    
    const isDuplicate = deviceRegistry[location].some(item => item.id === id);
    if (!isDuplicate) {
        deviceRegistry[location].push({ 
            id, 
            displayText: deviceDisplayText, 
            fullConfig: config 
        });
        return true; 
    }
    return false; 
}