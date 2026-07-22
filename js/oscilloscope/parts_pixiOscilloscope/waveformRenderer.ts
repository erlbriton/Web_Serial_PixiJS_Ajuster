// js/oscilloscope/parts_pixiOscilloscope/waveformRenderer.ts
import { RowGeometry } from "../../model/scopeLayout.js";

export function drawWaveform(
    g: any,
    dataRaw: Float32Array | number[],
    geom: RowGeometry,
    isDiscrete: boolean,
    color: number,
    width: number,
    maxValues: number[]
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
        let started = false;
        for (let j = 0; j < data.length; j++) {
            const x = width - (j * 2);
            if (x < 0) break;
            
            const maxVal = maxValues[geom.channelIndex] || 1100;
            const rawVal = data[data.length - 1 - j];
            const absVal = Math.abs(rawVal);
            
            const lineColor = rawVal < 0 ? 0xFF0000 : color;
            
            const val = (absVal / maxVal) * (height - 4);
            const py = y + (height - 2 - val);
            
            g.lineStyle(1, lineColor, 0.9);
            if (!started) { g.moveTo(x, py); started = true; }
            else { g.lineTo(x, py); }
        }
    }
}