class IniParser {
    constructor() {
        this.parsedData = {};
        // Здесь мы создаем пустой объект, который будет "базой" множителей
        this.multiplierCache = {};
        this.varsDictionary = {}; // Здесь будут лежать значения [vars]    
    }

    /**
     * Возвращает множитель для конкретного параметра.
     * @param {string} section - Имя секции (например, 'FLASH')
     * @param {string} key - Имя ключа (например, 'VOLT_ADC')
     * @returns {string} - Множитель (по умолчанию "1.0")
     */

    //Заполняем словарь [VARS]
    getMultiplier(section, key) {
    // 1. Берем сырую ссылку (например, "CINScale" или "0.0226")
    const rawVal = this.multiplierCache[section]?.[key] || "1.0";

    // 2. Если в словаре varsDictionary есть такое значение, берем его
    // Если нет (это просто число), оставляем как есть
    const valueToParse = this.varsDictionary[rawVal] || rawVal;

    // 3. Преобразуем в число
    const floatVal = parseFloat(valueToParse.replace(',', '.'));
    return isNaN(floatVal) ? 1.0 : floatVal;
}

    /**
     * Основная функция парсинга текста INI файла
     * @param {string} text - Содержимое файла
     * @returns {object} - Структурированный объект с данными
     */

    parse(text) {
        // 1. Очищаем все старые данные
        this.parsedData = {};
        this.varsDictionary = {};

        // 2. Разбиваем текст на строки
        const lines = text.split(/\r?\n/);

        // 3. Вызываем методы через this
        this.scanVariables(lines); // Первый проход: сбор словаря
        this.parseData(lines);     // Второй проход: парсинг данных с учетом словаря
        return this.parsedData;
    }
    
    // 2. ПЕРВЫЙ ПРОХОД: Собираем только словарь переменных
    scanVariables(lines) {
        let inVars = false;
        for (const line of lines) {
            const trimmed = line.trim();

            // Переключаем режим, если встретили заголовок
            if (trimmed === '[vars]') { inVars = true; continue; }
            if (trimmed.startsWith('[')) { inVars = false; } // Вышли из секции

            // Если мы в [vars] и есть '=', сохраняем
            if (inVars && trimmed.includes('=')) {
                const [key, value] = trimmed.split('=');
                this.varsDictionary[key.trim()] = value.trim();
            }
        }
    }

    // Второй проход: парсим всё остальное
    parseData(lines) {
    let currentSection = null;

    for (const line of lines) {
        // Исправлено: не меняем 'line', а создаем новую переменную
        const trimmedLine = line.trim();

        // Игнорируем пустые строки и комментарии
        if (trimmedLine === '' || trimmedLine.startsWith(';')) {
            continue;
        }

        // Ищем заголовок секции
        const sectionMatch = trimmedLine.match(/^\[(.*?)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].toUpperCase();
            this.parsedData[currentSection] = {};
            continue;
        }

        // Парсим пары ключ=значение
        if (currentSection !== null && trimmedLine.includes('=')) {
            const splitIndex = trimmedLine.indexOf('=');
            const key = trimmedLine.substring(0, splitIndex).trim();
            const rawValue = trimmedLine.substring(splitIndex + 1).trim();

            if (['RAM', 'CD', 'FLASH', 'EVENTS', 'STAT'].includes(currentSection) && rawValue.includes('/')) {
                let valuesArray = rawValue.split('/');
                if (valuesArray[valuesArray.length - 1] === '') {
                    valuesArray.pop();
                }
                this.parsedData[currentSection][key] = valuesArray;

                if (!this.multiplierCache[currentSection]) {
                    this.multiplierCache[currentSection] = {};
                }
                
                // Сохраняем сырое значение (например, "CINScale")
                this.multiplierCache[currentSection][key] = valuesArray[6] || "1.0";

            } else {
                this.parsedData[currentSection][key] = rawValue;
            }
        }
    }
    return this.parsedData;
}



    // parse(text) {
    //     this.parsedData = {};
    //     let currentSection = null;

    //     // Разбиваем текст на строки, поддерживая разные форматы переноса каретки
    //     const lines = text.split(/\r?\n/);



    //     for (let line of lines) {
    //         line = line.trim();

    //         // Игнорируем пустые строки и комментарии
    //         if (line === '' || line.startsWith(';')) {
    //             continue;
    //         }

    //         // Ищем заголовок секции, например [RAM]
    //         const sectionMatch = line.match(/^\[(.*?)\]$/);
    //         if (sectionMatch) {
    //             // Приводим названия секций к верхнему регистру для единообразия
    //             currentSection = sectionMatch[1].toUpperCase();
    //             this.parsedData[currentSection] = {};
    //             continue;
    //         }

    //         // Парсим пары ключ=значение
    //         if (currentSection !== null && line.includes('=')) {
    //             // Разделяем только по первому знаку '=', так как в значении могут быть еще '='
    //             const splitIndex = line.indexOf('=');
    //             const key = line.substring(0, splitIndex).trim();
    //             let rawValue = line.substring(splitIndex + 1).trim();

    //             // Если это секции с параметрами, разделенными слэшем '/'
    //             if (['RAM', 'CD', 'FLASH', 'EVENTS', 'STAT'].includes(currentSection) && rawValue.includes('/')) {
    //                 // Разбиваем строку в массив и удаляем последний пустой элемент, 
    //                 // если строка заканчивалась на '/'
    //                 let valuesArray = rawValue.split('/');
    //                 if (valuesArray[valuesArray.length - 1] === '') {
    //                     valuesArray.pop();
    //                 }
    //                 this.parsedData[currentSection][key] = valuesArray;

    //                 if (!this.multiplierCache[currentSection]) {
    //                     this.multiplierCache[currentSection] = {};
    //                 }

    //                 // 2. Кладем множитель в кэш. 
    //                 // Ключ - это имя параметра (key), значение - 6-й элемент массива (valuesArray[6])
    //                 // Если значения там нет, ставим "1.0" (как безопасный фолбек)
    //                 this.multiplierCache[currentSection][key] = valuesArray[6] || "1.0";

    //             } else {
    //                 // Обычное значение (для [DEVICE], [vars] и т.д.)
    //                 this.parsedData[currentSection][key] = rawValue;
    //             }
    //         }
    //     }

    //     return this.parsedData;
    // }

    /**
     * Вспомогательный метод: Возвращает объект с именованными полями для параметра
     * на основе структуры из документации.
     */
    getParsedParameter(section, key) {
        const dataArray = this.parsedData[section.toUpperCase()]?.[key];

        if (!Array.isArray(dataArray)) {
            return null; // Если параметра нет или это не массив
        }

        // Базовый маппинг на основе структуры (Имя/Описание/Тип/АдресHex/АдресReg/...)
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
            value: dataArray[9] || dataArray[8] || "" // Значение может смещаться в зависимости от формата
        };
    }
}