// js/oscilloscope/parts_pixiOscilloscope/rendererManager.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { ScopeLayout } from "../../model/scopeLayout.js";
import { calculateMaxValues } from "./dataProcessor.js";
import { drawWaveform as drawWaveformExternal } from "./waveformRenderer.js";

export function renderOscilloscope(
    lastBuffers: any[] | undefined,
    layout: ScopeLayout,
    scrollY: number,
    height: number,
    width: number,
    maxValues: number[],
    backgroundGraphics: any[],
    waveformGraphics: any[],
    brightColors: number[]
): void {
    const model = (window as any).oscModel as MonitorModel;
    if (!model) return;

    const visibleRows = layout.getVisibleRows(scrollY, height);
    if (lastBuffers) {
        calculateMaxValues(lastBuffers, maxValues);
    }

    let visibleIndex = 0;
    let discreteCounter = 0;

    for (const rowGeom of visibleRows) {
        const bg = backgroundGraphics[visibleIndex];
        const wave = waveformGraphics[visibleIndex];

        if (!bg || !wave) break;

        const data = lastBuffers && lastBuffers[rowGeom.channelIndex]
            ? lastBuffers[rowGeom.channelIndex].getLinearData()
            : null;

        if (data && data.length > 1) {
            bg.visible = true;
            wave.visible = true;

            bg.clear();
            wave.clear();

            bg.beginFill(0x1a1a1a);
            bg.drawRect(0, rowGeom.y, width, rowGeom.height);
            bg.endFill();

            const currentRow = model.rows[rowGeom.channelIndex];
            const isDiscrete = currentRow && String(currentRow.signal.dataType || '').trim() === 'TBit';

            const waveColor = isDiscrete 
                ? ((discreteCounter % 2 === 0) ? 0x00BFFF : 0x8B4513) 
                : brightColors[rowGeom.channelIndex % 10];
            
            if (isDiscrete) {
                discreteCounter++;
            }

            drawWaveformExternal(wave, data, rowGeom, isDiscrete, waveColor, width, maxValues, currentRow);
        } else {
            bg.visible = false;
            wave.visible = false;
        }
        visibleIndex++;
    }

    for (let j = visibleIndex; j < backgroundGraphics.length; j++) {
        backgroundGraphics[j].visible = false;
        waveformGraphics[j].visible = false;
    }
}