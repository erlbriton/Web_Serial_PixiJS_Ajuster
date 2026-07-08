/**
 * Класс IniParser
 * Предназначен для обработки INI-файлов WebAjuster.
 * Работает в два этапа: 
 * 1. Сбор переменных из секции [vars].
 * 2. Парсинг данных с автоматическим расчетом множителей (разрешением ссылок на переменные).
 */
export class IniParser {
    constructor() {
        // Итоговый объект со всеми данными файла
        this.parsedData = {};
        
        // Кэш множителей: содержит уже готовые числовые значения (или строки-числа)
        // Структура: { Секция: { Ключ: Значение_множителя } }
        this.multiplierCache = {};
        
        // Словарь переменных: хранит пары ключ-значение из секции [vars]
        this.varsDictionary = {}; 
    }

    /**
     * Вспомогательный метод для получения множителя (для обратной совместимости).
     * @returns {number} - Числовое значение множителя
     */
    getMultiplier(section, key) {
        const rawVal = this.multiplierCache[section]?.[key] || "1.0";
        // Если в словаре был какой-то текст, здесь он уже будет разрешен в число
        const floatVal = parseFloat(rawVal.replace(',', '.'));
        return isNaN(floatVal) ? 1.0 : floatVal;
    }

    /**
     * Основная точка входа для парсинга текста.
     */
    parse(text) {
        // Очищаем состояние перед новым парсингом
        this.parsedData = {};
        this.varsDictionary = {};
        this.multiplierCache = {};

        const lines = text.split(/\r?\n/);

        // 1. Первый проход: заполняем словарь [vars]
        this.scanVariables(lines);
        
        // 2. Второй проход: парсим данные, используя накопленный словарь
        this.parseData(lines);
        
        return this.parsedData;
    }
    
    /**
     * Сбор всех переменных из секции [vars].
     * Необходимо выполнить до основного парсинга данных.
     */
    scanVariables(lines) {
        let inVars = false;
        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '[vars]') { inVars = true; continue; }
            if (trimmed.startsWith('[')) { inVars = false; } // Выход из секции [vars]

            // Сохраняем все найденные пары ключ=значение в словарь
            if (inVars && trimmed.includes('=')) {
                const [key, value] = trimmed.split('=');
                this.varsDictionary[key.trim()] = value.trim();
            }
        }
    }

    /**
     * Основной парсинг данных файла.
     * Здесь происходит "разрешение" множителей: ссылки (напр. "CINScale") 
     * заменяются на реальные значения из словаря.
     */
    parseData(lines) {
        let currentSection = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine === '' || trimmedLine.startsWith(';')) continue;

            // Определяем текущую секцию
            const sectionMatch = trimmedLine.match(/^\[(.*?)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].toUpperCase();
                this.parsedData[currentSection] = {};
                continue;
            }

            // Обработка пар ключ=значение
            if (currentSection !== null && trimmedLine.includes('=')) {
                const splitIndex = trimmedLine.indexOf('=');
                const key = trimmedLine.substring(0, splitIndex).trim();
                const rawValue = trimmedLine.substring(splitIndex + 1).trim();

                // Проверяем, нужно ли вычислять множитель для этой секции.
                // Исключаем EVENTS и STAT, так как у них нет множителей (индекса 6).
                const supportsMultiplier = ['RAM', 'CD', 'FLASH'].includes(currentSection);

                if (supportsMultiplier && rawValue.includes('/')) {
                    let valuesArray = rawValue.split('/');
                    if (valuesArray[valuesArray.length - 1] === '') valuesArray.pop();
                    
                    this.parsedData[currentSection][key] = valuesArray;

                    if (!this.multiplierCache[currentSection]) {
                        this.multiplierCache[currentSection] = {};
                    }
                    
                    // --- ЛОГИКА РАЗРЕШЕНИЯ МНОЖИТЕЛЯ ---
                    // 1. Берем сырое значение (индекс 6 — это множитель по формату)
                    const rawScale = (valuesArray[6] || "1.0").trim();
                    
                    // 2. Ищем значение в словаре переменных. 
                    // Если ключ найден — берем значение из словаря, если нет — считаем, что это число.
                    this.multiplierCache[currentSection][key] = this.varsDictionary.hasOwnProperty(rawScale) 
                        ? this.varsDictionary[rawScale] 
                        : rawScale;

                } else {
                    // Обычные параметры без множителей
                    this.parsedData[currentSection][key] = rawValue;
                }
            }
        }
        
        // Отладочный вывод для проверки: в кэше должны быть только числа
        console.log("DEBUG: Содержимое multiplierCache:", this.multiplierCache);
        return this.parsedData;
    }

    /**
     * Вспомогательный метод для получения структуры параметра.
     */
    getParsedParameter(section, key) {
        const dataArray = this.parsedData[section.toUpperCase()]?.[key];
        if (!Array.isArray(dataArray)) return null;

        return {
            name: dataArray[0] || "",
            description: dataArray[1] || "",
            dataType: dataArray[2] || "",
            hexAddress: dataArray[3] || "",
            regAddress: dataArray[4] || "",
            unit: dataArray[5] || "",
            multiplier: dataArray[6] || "",
            byteCount: dataArray[7] || "",
            sign: dataArray[8] || "",
            value: dataArray[9] || dataArray[8] || ""
        };
    }
}