// js/oscilloscope/parts_pixiOscilloscope/dataProcessor.ts

export function calculateMaxValues(buffers: any[], maxValuesArray: number[]): void {
    // Размер окна: берем только последние 200 точек (свежие данные на экране)
    const WINDOW_SIZE = 200;

    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        if (!buffer) {
            maxValuesArray[i] = 1100; // Значение по умолчанию
            continue;
        }

        const data = buffer.getLinearData();
        let maxVal = 0;
        
        // Ограничиваем поиск хвостом массива (последними WINDOW_SIZE точками)
        const startIndex = Math.max(0, data.length - WINDOW_SIZE);

        for (let j = startIndex; j < data.length; j++) {
            const absVal = Math.abs(data[j]);
            if (absVal > maxVal) {
                maxVal = absVal;
            }
        }

        // Если максимум слишком маленький, используем минимальное значение
        maxValuesArray[i] = maxVal < 10 ? 1100 : maxVal;
    }
}