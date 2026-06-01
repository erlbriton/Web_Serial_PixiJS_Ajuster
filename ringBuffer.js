// ringBuffer.js
class RingBuffer {
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