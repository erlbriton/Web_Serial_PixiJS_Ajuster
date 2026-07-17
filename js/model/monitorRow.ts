import { MonitorSignal } from "./monitorSignal.js";

export class MonitorRow {

    /** Уникальный идентификатор строки */
    readonly id: string;

    /** Сигнал, который отображается в строке */
    signal: MonitorSignal;

    /** Дополнительные сигналы для режима Overlay */
    overlays: MonitorSignal[];

    /** Высота строки в пикселях */
    height: number;

    /** Показывать строку */
    visible: boolean;

    /** Строка выделена пользователем */
    selected: boolean;

    constructor(signal: MonitorSignal) {

        this.id = signal.id;

        this.signal = signal;

        this.overlays = [];

        this.height = 20;

        this.visible = true;

        this.selected = false;
    }
}