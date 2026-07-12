// js/oscilloscope/ringBuffer.ts
import { parseRegisterAddress } from '../ini-manager/tree-core.js';

export class RingBuffer {
    private capacity: number;
    private buffer: Float32Array;
    private writePointer: number;
    private totalStored: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Float32Array(capacity);
        this.writePointer = 0;
        this.totalStored = 0;
    }

    // Добавление одной точки в буфер
    push(value: number): void {
        this.buffer[this.writePointer] = value;
        this.writePointer = (this.writePointer + 1) % this.capacity;
        if (this.totalStored < this.capacity) {
            this.totalStored++;
        }
    }

    // Получение линейного массива от старых точек к самым новым
    getLinearData(): Float32Array {
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

interface RamRange {
    start: number;
    count: number;
}

/**
 * Вычисляет начальный адрес и количество регистров для чтения секции RAM.
 */
export function calculateRamRange(ramSection: Record<string, string[]>): RamRange {
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