// js/oscilloscope/parts_pixiOscilloscope/waveformRenderer.ts
import { RowGeometry } from "../../model/scopeLayout.js";

export function drawWaveform(
    g: any,
    dataRaw: Float32Array | number[],
    geom: RowGeometry,
    isDiscrete: boolean,
    color: number,
    width: number,
    maxValues: any[], // 7-й аргумент (для совместимости)
    row?: any         // 8-й аргумент — объект строки со шкалой
): void {
    if (!dataRaw || dataRaw.length === 0) return;

    // Испольуем исходный Float32Array напрямую без Array.from() для экономии памяти/GC
    const data = dataRaw;
    const dataLen = data.length;

    const { y, height } = geom;
    const gridSpacing = 50;
    const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
    const gridStartX = width - timePhasePx;

    // Сетка
    g.lineStyle(1, 0x333333, 1);
    for (let x = gridStartX; x >= 0; x -= gridSpacing) {
        g.moveTo(x, y);
        g.lineTo(x, y + height - 1);
    }

    if (isDiscrete) {
        let segStartVal = data[dataLen - 1];
        let segStartX = width;

        const drawSeg = (x1: number, x2: number, val: number) => {
            if (x1 <= x2) return;
            if (val !== 0) {
                g.lineStyle(0);
                g.beginFill(color, 1);
                const h = Math.max(4, height - 6);
                g.drawRect(x2, y + (height - h) / 2, x1 - x2, h);
                g.endFill();
            } else {
                g.lineStyle(1.5, color, 1);
                g.moveTo(x1, y + height - 3);
                g.lineTo(x2, y + height - 3);
            }
        };

        for (let j = 0; j < dataLen; j++) {
            const x = width - (j * 2);
            if (x < 0) { drawSeg(segStartX, 0, segStartVal); break; }
            const val = data[dataLen - 1 - j];
            if (val !== segStartVal) {
                drawSeg(segStartX, x, segStartVal);
                segStartVal = val;
                segStartX = x;
            }
        }
        const finalX = width - (dataLen * 2);
        if (finalX > 0) drawSeg(segStartX, finalX, segStartVal);

    } else {
        // Проверяем флаг автомасштаба
        const isAuto = row?.autoScale ?? true;
        let displayMin = 0;
        let displayMax = 100;

        if (isAuto) {
            // Автоматический масштаб — окно расчёта (40 последних точек)
            const scaleWindow = Math.min(dataLen, 40);
            let currentMin = Infinity;
            let currentMax = -Infinity;

            if (scaleWindow > 0) {
                const startIndex = dataLen - scaleWindow;
                for (let k = startIndex; k < dataLen; k++) {
                    const val = data[k];
                    if (val < currentMin) currentMin = val;
                    if (val > currentMax) currentMax = val;
                }
            }

            if (currentMin === Infinity || currentMax === -Infinity) {
                currentMin = 0;
                currentMax = 100;
            }

            if (currentMin >= 0) {
                displayMin = 0;
                let rawMax = Math.max(currentMax, 1.0);
                if (rawMax < 0.1) rawMax = 1.0;
                displayMax = rawMax * 1.15;
            } else {
                const absPeak = Math.max(Math.abs(currentMin), Math.abs(currentMax), 1.0);
                displayMax = absPeak * 1.15;
                displayMin = -displayMax;
            }

            // Сохраняем рассчитанные значения
            if (row && row.scale) {
                row.scale.displayMin = displayMin;
                row.scale.displayMax = displayMax;
            }
        } else if (row && row.scale) {
            displayMin = row.scale.displayMin ?? 0;
            displayMax = row.scale.displayMax ?? 100;
        }

        const span = displayMax - displayMin;
        if (span <= 0) return;

        const usableHeight = height - 4;
        const minY = y + 2;
        const maxY = y + height - 2;

        let started = false;
        for (let j = 0; j < dataLen; j++) {
            const x = width - (j * 2);
            if (x < 0) break;
            
            const rawVal = data[dataLen - 1 - j];
            const lineColor = rawVal < 0 ? 0xFF0000 : color;
            
            const normalized = (rawVal - displayMin) / span;
            let py = y + height - 2 - normalized * usableHeight;

            // Ограничиваем рамками строки
            py = Math.max(minY, Math.min(maxY, py));
            
            g.lineStyle(1, lineColor, 0.9);
            if (!started) { g.moveTo(x, py); started = true; }
            else { g.lineTo(x, py); }
        }
    }
}