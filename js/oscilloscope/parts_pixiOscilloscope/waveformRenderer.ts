// js/oscilloscope/parts_pixiOscilloscope/waveformRenderer.ts
import { RowGeometry } from "../../model/scopeLayout.js";

export function drawWaveform(
    g: any,
    dataRaw: Float32Array | number[],
    geom: RowGeometry,
    isDiscrete: boolean,
    color: number,
    width: number,
    maxValues: any[], // 7-й аргумент (сохраняем для совместимости вызова)
    row?: any         // 8-й аргумент — объект строки со шкалой
): void {
    const data = Array.from(dataRaw);
    const { y, height } = geom;
    const gridSpacing = 50;
    const timePhasePx = ((Date.now() % 1000) / 1000) * gridSpacing;
    const gridStartX = width - timePhasePx;

    g.lineStyle(1, 0x333333, 1);
    for (let x = gridStartX; x >= 0; x -= gridSpacing) {
        g.moveTo(x, y);
        g.lineTo(x, y + height - 1);
    }

    if (isDiscrete) {
        let segStartVal = data[data.length - 1];
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

        for (let j = 0; j < data.length; j++) {
            const x = width - (j * 2);
            if (x < 0) { drawSeg(segStartX, 0, segStartVal); break; }
            const val = data[data.length - 1 - j];
            if (val !== segStartVal) {
                drawSeg(segStartX, x, segStartVal);
                segStartVal = val;
                segStartX = x;
            }
        }
        const finalX = width - (data.length * 2);
        if (finalX > 0) drawSeg(segStartX, finalX, segStartVal);

    } else {
        // Проверяем, включено ли автомасштабирование (по умолчанию true, если не задано)
        const isAuto = row?.autoScale ?? true;
        let displayMin = 0;
        let displayMax = 100;

        if (isAuto) {
            // Расчёт максимума ТОЛЬКО из точек, видимых на экране (x >= 0)
            const visibleCount = Math.min(data.length, Math.ceil(width / 2));
            let peak = 0;

            if (visibleCount > 0) {
                const startIndex = data.length - visibleCount;
                for (let k = startIndex; k < data.length; k++) {
                    const absVal = Math.abs(data[k]);
                    if (absVal > peak) peak = absVal;
                }
            }
            
            displayMax = peak > 0 ? peak * 1.1 : 100;
            displayMin = 0;
        } else if (row && row.scale) {
            displayMin = row.scale.displayMin;
            displayMax = row.scale.displayMax;
        }

        const span = displayMax - displayMin;
        if (span <= 0) return;

        const usableHeight = height - 4;
        const minY = y + 2;
        const maxY = y + height - 2;

        let started = false;
        for (let j = 0; j < data.length; j++) {
            const x = width - (j * 2);
            if (x < 0) break;
            
            const rawVal = data[data.length - 1 - j];
            const lineColor = rawVal < 0 ? 0xFF0000 : color;
            
            const normalized = (rawVal - displayMin) / span;
            let py = y + height - 2 - normalized * usableHeight;

            py = Math.max(minY, Math.min(maxY, py));
            
            g.lineStyle(1, lineColor, 0.9);
            if (!started) { g.moveTo(x, py); started = true; }
            else { g.lineTo(x, py); }
        }
    }
}