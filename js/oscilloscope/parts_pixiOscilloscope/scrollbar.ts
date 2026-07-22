// js/oscilloscope/parts_pixiOscilloscope/scrollbar.ts

import { MonitorModel } from "../../model/monitorModel.js";

export function updateScrollbar(
    scrollY: number,
    height: number,
    scrollbarTrack: HTMLElement,
    scrollbarThumb: HTMLElement
): void {
    const model = (window as any).oscModel as MonitorModel;
    if (!model) return;

    const totalHeight = model.rows.reduce((sum: number, row: any) => sum + row.height, 0);

    if (totalHeight <= height) {
        scrollbarTrack.style.display = 'none';
        return;
    }
    scrollbarTrack.style.display = 'block';

    const thumbHeight = Math.max(20, (height / totalHeight) * height);
    const maxTop = height - thumbHeight;
    const thumbTop = (scrollY / (totalHeight - height)) * maxTop;

    scrollbarThumb.style.height = `${thumbHeight}px`;
    scrollbarThumb.style.top = `${thumbTop}px`;
}

export function handleWheelScroll(
    deltaY: number,
    scrollY: number,
    height: number,
    stageContainer: any,
    scrollbarTrack: HTMLElement,
    scrollbarThumb: HTMLElement,
    tableWrapper: HTMLElement | null
): { newScrollY: number, needsRedraw: boolean } {
    const model = (window as any).oscModel as MonitorModel;
    if (!model) return { newScrollY: scrollY, needsRedraw: false };

    const totalHeight = model.rows.reduce((sum: number, row: any) => sum + row.height, 0);
    const maxScroll = Math.max(0, totalHeight - height);

    let newScrollY = scrollY + deltaY * 1.5;
    newScrollY = Math.max(0, Math.min(newScrollY, maxScroll));

    if (stageContainer) {
        stageContainer.y = -newScrollY;
    }

    updateScrollbar(newScrollY, height, scrollbarTrack, scrollbarThumb);

    if (tableWrapper) {
        tableWrapper.scrollTop = newScrollY;
    }

    return { newScrollY, needsRedraw: true };
}