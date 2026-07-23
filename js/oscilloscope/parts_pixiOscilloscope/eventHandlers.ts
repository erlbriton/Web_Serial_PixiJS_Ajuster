// js/oscilloscope/parts_pixiOscilloscope/eventHandlers.ts
import { MonitorModel } from "../../model/monitorModel.js";
import { handleWheelScroll } from "./scrollbar.js";
import { handleCanvasClick, handleCanvasContextMenu } from "./canvasInteraction.js";

export interface EventHandlersState {
    scrollY: number;
    height: number;
    selectedRow: HTMLElement | null;
}

export function setupCanvasEvents(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    stageContainer: any,
    scrollbarTrack: HTMLDivElement,
    scrollbarThumb: HTMLDivElement,
    tableWrapper: HTMLElement | null,
    highlighter: HTMLDivElement,
    getState: () => EventHandlersState,
    setState: (updates: Partial<EventHandlersState> & { needsRedraw?: boolean }) => void,
    onContextUpdate: () => void
): void {
    container.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const state = getState();
        const result = handleWheelScroll(
            e.deltaY,
            state.scrollY,
            state.height,
            stageContainer,
            scrollbarTrack,
            scrollbarThumb,
            tableWrapper
        );
        setState({ scrollY: result.newScrollY, needsRedraw: result.needsRedraw });
    }, { passive: false });

    canvas.addEventListener('click', (e: MouseEvent) => {
        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const state = getState();
        const selectedRef = { current: state.selectedRow };

        handleCanvasClick(
            e,
            canvas,
            state.scrollY,
            container.getBoundingClientRect(),
            model,
            selectedRef,
            highlighter,
            (newSelectedRow: HTMLElement | null) => {
                setState({ selectedRow: newSelectedRow });
            }
        );
    });

    canvas.addEventListener('contextmenu', (e: MouseEvent) => {
        const model = (window as any).oscModel as MonitorModel;
        if (!model) return;

        const state = getState();
        const selectedRef = { current: state.selectedRow };

        handleCanvasContextMenu(
            e,
            canvas,
            state.scrollY,
            container.getBoundingClientRect(),
            model,
            selectedRef,
            highlighter,
            (newSelectedRow: HTMLElement | null) => {
                setState({ selectedRow: newSelectedRow });
            },
            onContextUpdate
        );
    });
}