class IniParser {
    constructor() {
        this.parsedData = {};
    }

    /**
     * Основная функция парсинга текста INI файла
     * @param {string} text - Содержимое файла
     * @returns {object} - Структурированный объект с данными
     */
    parse(text) {
        this.parsedData = {};
        let currentSection = null;

        // Разбиваем текст на строки, поддерживая разные форматы переноса каретки
        const lines = text.split(/\r?\n/);

        for (let line of lines) {
            line = line.trim();

            // Игнорируем пустые строки и комментарии
            if (line === '' || line.startsWith(';')) {
                continue;
            }

            // Ищем заголовок секции, например [RAM]
            const sectionMatch = line.match(/^\[(.*?)\]$/);
            if (sectionMatch) {
                // Приводим названия секций к верхнему регистру для единообразия
                currentSection = sectionMatch[1].toUpperCase(); 
                this.parsedData[currentSection] = {};
                continue;
            }

            // Парсим пары ключ=значение
            if (currentSection !== null && line.includes('=')) {
                // Разделяем только по первому знаку '=', так как в значении могут быть еще '='
                const splitIndex = line.indexOf('=');
                const key = line.substring(0, splitIndex).trim();
                let rawValue = line.substring(splitIndex + 1).trim();

                // Если это секции с параметрами, разделенными слэшем '/'
                if (['RAM', 'CD', 'FLASH', 'EVENTS', 'STAT'].includes(currentSection) && rawValue.includes('/')) {
                    // Разбиваем строку в массив и удаляем последний пустой элемент, 
                    // если строка заканчивалась на '/'
                    let valuesArray = rawValue.split('/');
                    if (valuesArray[valuesArray.length - 1] === '') {
                        valuesArray.pop();
                    }
                    this.parsedData[currentSection][key] = valuesArray;
                } else {
                    // Обычное значение (для [DEVICE], [vars] и т.д.)
                    this.parsedData[currentSection][key] = rawValue;
                }
            }
        }

        return this.parsedData;
    }

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