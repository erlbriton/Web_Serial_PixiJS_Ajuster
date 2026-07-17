//js/iniParser.ts

export interface Parameter {
    name: string;
    description: string;
    dataType: string;
    hexAddress: string;
    regAddress: string;
    unit: string;
    multiplier: string;
    byteCount: string;
    sign: string;
    value: string;
}

export class IniParser {
    private parsedData: Record<string, Record<string, any>>;
    private multiplierCache: Record<string, Record<string, string>>;
    private varsDictionary: Record<string, string>;

    constructor() {
        this.parsedData = {};
        this.multiplierCache = {};
        this.varsDictionary = {};
    }

    // Новый метод для прямой загрузки уже готового конфига
    setData(data: Record<string, Record<string, any>>): void {
        this.parsedData = data;
        // Опционально можно сбросить кэши, так как данные уже "готовы"
        this.multiplierCache = {}; 
        this.varsDictionary = {};
    }

    getMultiplier(section: string, key: string): number {
        const sectionData = this.multiplierCache[section.toUpperCase()];
        const rawVal = sectionData?.[key] || "1.0";
        const floatVal = parseFloat(rawVal.replace(',', '.'));
        return isNaN(floatVal) ? 1.0 : floatVal;
    }

    parse(text: string): Record<string, Record<string, any>> {
        this.parsedData = {};
        this.varsDictionary = {};
        this.multiplierCache = {};

        const lines = text.split(/\r?\n/);
        this.scanVariables(lines);
        this.parseData(lines);
        
        return this.parsedData;
    }

    private scanVariables(lines: string[]): void {
        let inVars = false;
        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '[vars]') { inVars = true; continue; }
            if (trimmed.startsWith('[')) { inVars = false; }

            if (inVars && trimmed.includes('=')) {
                const [key, value] = trimmed.split('=');
                this.varsDictionary[key.trim()] = value.trim();
            }
        }
    }

    private parseData(lines: string[]): void {
        let currentSection: string | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith(';')) continue;

            const sectionMatch = trimmedLine.match(/^\[(.*?)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].toUpperCase();
                this.parsedData[currentSection] = {};
                continue;
            }

            if (currentSection !== null && trimmedLine.includes('=')) {
                const splitIndex = trimmedLine.indexOf('=');
                const key = trimmedLine.substring(0, splitIndex).trim();
                const rawValue = trimmedLine.substring(splitIndex + 1).trim();

                const supportsMultiplier = ['RAM', 'CD', 'FLASH'].includes(currentSection);

                if (supportsMultiplier && rawValue.includes('/')) {
                    let valuesArray = rawValue.split('/');
                    if (valuesArray[valuesArray.length - 1] === '') valuesArray.pop();
                    
                    this.parsedData[currentSection][key] = valuesArray;

                    if (!this.multiplierCache[currentSection]) {
                        this.multiplierCache[currentSection] = {};
                    }
                    
                    const rawScale = (valuesArray[6] || "1.0").trim();
                    this.multiplierCache[currentSection][key] = this.varsDictionary.hasOwnProperty(rawScale) 
                        ? this.varsDictionary[rawScale] 
                        : rawScale;

                } else {
                    this.parsedData[currentSection][key] = rawValue;
                }
            }
        }
        console.log("DEBUG: Содержимое multiplierCache:", this.multiplierCache);
    }

    getParsedParameter(section: string, key: string): Parameter | null {
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
    getSectionParameterKeys(section: string): string[] {
        const data = this.parsedData[section.toUpperCase()];
        return data ? Object.keys(data) : [];
    }

/**
     * Возвращает массив всех параметров из указанной секции (например, 'RAM')
     */
    getSectionParameters(section: string): Parameter[] {
        const keys = this.getSectionParameterKeys(section);
        const parameters: Parameter[] = [];

        for (const key of keys) {
            const param = this.getParsedParameter(section, key);
            if (param) {
                parameters.push(param);
            }
        }
        return parameters;
    }

}