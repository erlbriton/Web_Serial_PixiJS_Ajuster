export const deviceRegistry = {};
export let currentDeviceConfig = null;

export function setCurrentDeviceConfig(config) {
    currentDeviceConfig = config;
}
// Вспомогательная функция для парсинга адресов
export function parseRegisterAddress(addrString) {
    if (!addrString || addrString === '*') return { reg: null, sub: null };
    const cleanStr = addrString.toLowerCase().replace('r', '');
    const parts = cleanStr.split('.');
    return {
        reg: parseInt(parts[0], 16),
        sub: parts[1] ? parts[1].toUpperCase() : null
    };
}

// Вспомогательная функция для HEX -> Float32
export function hexToFloat32(hexStr) {
    if (!hexStr) return NaN;
    const intVal = parseInt(hexStr, 16);
    if (isNaN(intVal)) return NaN;
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, intVal, false);
    return view.getFloat32(0, false);
}

// Вспомогательная функция для Float32 -> HEX
export function float32ToHex(floatVal, padLen = 8) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, floatVal, false);
    const intVal = view.getUint32(0, false);
    return 'x' + intVal.toString(16).toUpperCase().padStart(padLen, '0');
}

// Регистрация устройства
export function addDeviceToRegistry(config) {
    if (!config || !config['DEVICE']) return false;
    const dev = config['DEVICE'];
    const location = dev['Location'] || 'Неизвестное место';
    const id = dev['ID'] || dev['Id'] || dev['id'] || 'Без ID';
    const version = dev['Version'] || ''; 
    const date = dev['Date'] || '';
    const displayComponents = [id, version, date].filter(Boolean);
    const deviceDisplayText = displayComponents.join(' ');

    if (!deviceRegistry[location]) deviceRegistry[location] = [];
    const isDuplicate = deviceRegistry[location].some(item => item.id === id);
    if (!isDuplicate) {
        deviceRegistry[location].push({ id: id, displayText: deviceDisplayText, fullConfig: config });
        return true; 
    }
    return false; 
}