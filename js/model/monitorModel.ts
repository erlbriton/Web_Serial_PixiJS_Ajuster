// js/model/monitorModel.ts

import { MonitorRow } from "./monitorRow.js";

export class MonitorModel {

    /** Все строки осциллографа */
    readonly rows: MonitorRow[] = [];

    /** Очистить модель */
    clear(): void {
        this.rows.length = 0;
    }

    /** Добавить строку */
    addRow(row: MonitorRow): void {
        this.rows.push(row);
    }

    /** Количество строк */
    get rowCount(): number {
        return this.rows.length;
    }
}