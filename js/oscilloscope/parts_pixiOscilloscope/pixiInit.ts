// js/oscilloscope/parts_pixiOscilloscope/pixiInit.ts

export function initPixiApp(
    container: HTMLElement,
    width: number,
    height: number,
    backgroundColor: number
): {
    app: any;
    stageContainer: any;
    backgroundGraphics: any[];
    waveformGraphics: any[];
} {
    // @ts-ignore
    const app = new PIXI.Application({
        width,
        height,
        backgroundColor,
        antialias: true,
        autoStart: true
    });
    (app.view as HTMLCanvasElement).style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(app.view as HTMLCanvasElement);

    // @ts-ignore
    const stageContainer = new PIXI.Container();
    app.stage.addChild(stageContainer);

    const backgroundGraphics: any[] = [];
    const waveformGraphics: any[] = [];

    for (let i = 0; i < 300; i++) {
        // @ts-ignore
        const bg = new PIXI.Graphics();
        // @ts-ignore
        const wave = new PIXI.Graphics();

        stageContainer.addChild(bg);
        stageContainer.addChild(wave);

        backgroundGraphics.push(bg);
        waveformGraphics.push(wave);
    }

    return { app, stageContainer, backgroundGraphics, waveformGraphics };
}

// Новая функция для настройки ResizeObserver
export function setupResizeObserver(
    container: HTMLElement,
    app: any,
    stateRef: { 
        width: number; 
        height: number; 
        needsRedraw: boolean;
        setWidth: (w: number) => void;
        setHeight: (h: number) => void;
        setNeedsRedraw: () => void;
    }
): void {
    new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                stateRef.setWidth(width);
                stateRef.setHeight(height);
                app.renderer.resize(width, height);
                stateRef.setNeedsRedraw();
            }
        }
    }).observe(container);
}