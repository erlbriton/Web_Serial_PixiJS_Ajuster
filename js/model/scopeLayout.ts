// js/model/scopeLayout.ts
import { MonitorModel } from "./monitorModel.js";

export interface RowGeometry {
    y: number;           // Y-координата строки (относительно начала таблицы)
    height: number;      // Высота строки в пикселях
    channelIndex: number; // Индекс канала в MonitorModel.rows
}

export class ScopeLayout {
    private geometries: RowGeometry[] = [];
    private totalHeight: number = 0;
    
    /**
     * Пересчитать геометрию всех видимых строк.
     * Вызывается ТОЛЬКО когда изменилась высота или видимость строк.
     */
    recalculate(model: MonitorModel): void {
        this.geometries = [];
        this.totalHeight = 0;
        
        let currentY = 0;
        for (let i = 0; i < model.rows.length; i++) {
            const row = model.rows[i];
            if (row.visible) {
                this.geometries.push({
                    y: currentY,
                    height: row.height,
                    channelIndex: i
                });
                currentY += row.height;
            }
        }
        this.totalHeight = currentY;
    }
    
    /**
     * Получить геометрии только видимых строк в области просмотра.
     * @param scrollTop Текущая позиция скролла таблицы
     * @param viewportHeight Высота видимой области Canvas
     */
    getVisibleRows(scrollTop: number, viewportHeight: number): RowGeometry[] {
        const viewTop = scrollTop;
        const viewBottom = scrollTop + viewportHeight;
        
        // Простой линейный поиск (для 178 строк это мгновенно).
        // Если будет >1000 строк — заменим на бинарный поиск.
        return this.geometries.filter(g => 
            g.y + g.height >= viewTop && g.y <= viewBottom
        );
    }
    
    /**
     * Общая высота всех видимых строк (для синхронизации скроллбара)
     */
    getTotalHeight(): number {
        return this.totalHeight;
    }
    
    /**
     * Количество видимых строк
     */
    getVisibleCount(): number {
        return this.geometries.length;
    }
}