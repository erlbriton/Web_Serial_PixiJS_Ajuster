// ringBuffer.js

import { parseRegisterAddress } from '../ini-manager/tree-core.js';

export class RingBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Float32Array(capacity);
        this.writePointer = 0;
        this.totalStored = 0;
    }

    // Добавление одной точки в буфер без сдвига элементов в памяти
    push(value) {
        this.buffer[this.writePointer] = value;
        this.writePointer = (this.writePointer + 1) % this.capacity;
        if (this.totalStored < this.capacity) {
            this.totalStored++;
        }
    }

    // Получение линейного массива от старых точек к самым новым
    getLinearData() {
        if (this.totalStored === 0) return new Float32Array(0);
        
        const result = new Float32Array(this.totalStored);
        let readIndex = this.totalStored < this.capacity ? 0 : this.writePointer;
        
        for (let i = 0; i < this.totalStored; i++) {
            result[i] = this.buffer[readIndex];
            readIndex = (readIndex + 1) % this.capacity;
        }
        return result;
    }
}
/**
 * Вычисляет начальный адрес и количество регистров для чтения секции RAM.
 * @param {Object} ramSection - Объект с данными секции RAM из парсера.
 * @returns {Object} { start: number, count: number }
 */
export function calculateRamRange(ramSection) {
    let minAddr = Infinity;
    let maxAddr = -Infinity;

    for (const key in ramSection) {
        const parts = ramSection[key];
        const dataType = parts[2] || '';
        
        // Получаем адрес, учитывая специфику TBit
        const regAddrString = (dataType === 'TBit' ? (parts[5] || '') : (parts[4] || ''));
        const parsed = parseRegisterAddress(regAddrString);
        
        if (parsed.reg === null) continue;

        const start = parsed.reg;
        // TFloat и TDWORD занимают 2 регистра
        const end = (dataType === 'TFloat' || dataType === 'TDWORD') ? start + 1 : start;

        if (start < minAddr) minAddr = start;
        if (end > maxAddr) maxAddr = end;
    }

    if (minAddr === Infinity) return { start: 0, count: 0 };

    return {
        start: minAddr,
        count: (maxAddr - minAddr) + 1
    };
}