// js/model/monitorSignal.ts
import { RingBuffer } from "../oscilloscope/ringBuffer.js";

export interface MonitorSignal {
    /** Уникальный код параметра из INI (например p1000) */
    id: string;

    /** Имя параметра */
    name: string;

    /** Описание */
    description: string;

    /** Тип данных */
    dataType: string;

    /** Адрес Modbus-регистра */
    register: number;

    /** Единица измерения */
    unit: string;

    /** Коэффициент масштабирования (калибровка RAW -> Physical) */
    multiplier: number;

    /** Смещение (offset) — теперь опциональное поле */
    offset?: number;

    /** Буфер истории (хранит ТОЛЬКО чистые физические значения!) */
    buffer: RingBuffer;

    /** Последнее полученное физическое значение */
    currentValue: number;

    /** Внутреннее поле для отслеживания изменения шкалы и пересчета истории */
    _lastEffectiveScale?: number;
}