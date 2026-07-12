// js/table-saver.ts

/**
 * Вычисляет новое шестнадцатеричное представление значения на основе физического ввода.
 */
export function calculateNewHex(
    newValStr: string, 
    dataType: string, 
    scale: number, 
    originalHexLen: number, 
    float32ToHex: (val: number, len: number) => string
): string {
    // Нормализация разделителя дробной части
    let cleanValStr = newValStr.replace(',', '.');
    if (!cleanValStr) cleanValStr = '0';

    if (dataType === 'TBit') {
        return (cleanValStr === '1' || cleanValStr.toLowerCase() === 'true') ? '1' : '0';
    } 
    
    if (dataType === 'TFloat') {
        const floatVal = parseFloat(cleanValStr);
        const unscaled = (!isNaN(scale) && scale !== 0) ? floatVal / scale : floatVal;
        return float32ToHex(isNaN(unscaled) ? 0 : unscaled, originalHexLen);
    } 
    
    // Для всех остальных типов (целые числа)
    const physVal = parseFloat(cleanValStr);
    const unscaledInt = (!isNaN(scale) && scale !== 0) ? Math.round(physVal / scale) : Math.round(physVal);
    
    let val = isNaN(unscaledInt) ? 0 : unscaledInt;
    
    // Обработка знакового 16-битного числа
    if (val < 0) val = (val & 0xFFFF);
    
    return 'x' + val.toString(16).toUpperCase().padStart(originalHexLen, '0');
}