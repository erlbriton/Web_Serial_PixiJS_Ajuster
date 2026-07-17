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

    /** Коэффициент масштабирования */
    multiplier: number;

    /** Буфер истории */
    buffer: RingBuffer;

    /** Последнее полученное значение */
    currentValue: number;
}