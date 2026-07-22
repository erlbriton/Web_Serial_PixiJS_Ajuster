// js/model/monitorRow.ts
import { MonitorSignal } from "./monitorSignal.js";

export class MonitorRow {
    /** Уникальный идентификатор строки */
    readonly id: string;
    /** Сигнал, который отображается в строке */
    signal: MonitorSignal;
    /** Дополнительные сигналы для режима Overlay */
    overlays: MonitorSignal[] = []; // Инициализируем сразу, чтобы не было undefined
    /** Высота строки в пикселях */
    height: number;
    /** Показывать строку */
    visible: boolean;
    /** Строка выделена пользователем */
    selected: boolean;
    /** Максимальное значение шкалы для этой строки (в делениях) */
    maxScale: number; 

    constructor(signal: MonitorSignal) {
        this.id = signal.id;
        this.signal = signal;
        this.height = 20;
        this.visible = true;
        this.selected = false;
        this.maxScale = 1; // Значение по умолчанию
    }
}