// js/model/displayScale.ts

export class DisplayScale {
    /** Флаг автоматического масштабирования */
    auto: boolean = false;

    /** Текущий минимум отображения на графике */
    displayMin: number = 0;

    /** Текущий максимум отображения на графике */
    displayMax: number = 100;

    /** Базовый минимум из конфига */
    baseMin: number = 0;

    /** Базовый максимум из конфига */
    baseMax: number = 100;

    /** Коэффициент вертикального зума */
    verticalZoom: number = 1;

    constructor(baseMin = 0, baseMax = 100) {
        this.baseMin = baseMin;
        this.baseMax = baseMax;
        this.displayMin = baseMin;
        this.displayMax = baseMax;
    }

    /** Сброс на базовые настройки */
    resetToDefault(): void {
        this.displayMin = this.baseMin;
        this.displayMax = this.baseMax;
        this.verticalZoom = 1;
    }
}