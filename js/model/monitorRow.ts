// js/model/monitorRow.ts
import { MonitorSignal } from "./monitorSignal.js";
import { DisplayScale } from "./displayScale.js";

export class MonitorRow {
    /** Уникальный идентификатор строки */
    readonly id: string;
    
    /** Главный отображаемый сигнал */
    signal: MonitorSignal;
    
    /** Дополнительные сигналы для режима Overlay */
    overlays: MonitorSignal[] = [];
    
    /** Объект управления шкалой и отображением */
    scale: DisplayScale;
    
    /** Высота строки в пикселях */
    height: number;
    
    /** Показывать строку */
    visible: boolean;
    
    /** Строка выделена пользователем */
    selected: boolean;

    constructor(signal: MonitorSignal, baseMin = 0, baseMax = 100) {
        this.id = signal.id;
        this.signal = signal;
        this.scale = new DisplayScale(baseMin, baseMax);
        this.height = 20;
        this.visible = true;
        this.selected = false;
        
        // --- ИСПРАВЛЕНИЕ ---
        // Включаем автомасштаб по умолчанию сразу при создании строки.
        // Теперь рендерер графиков увидит это до того, как вы откроете настройки.
        this.autoScale = true; 
    }

    // === Прокси-свойства для обратной совместимости с рендерером графиков ===
    get min(): number {
        return this.scale.displayMin;
    }
    set min(val: number) {
        this.scale.displayMin = val;
    }

    get max(): number {
        return this.scale.displayMax;
    }
    set max(val: number) {
        this.scale.displayMax = val;
    }

    get autoScale(): boolean {
        return this.scale.auto;
    }
    set autoScale(val: boolean) {
        this.scale.auto = val;
    }
}