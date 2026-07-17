// js/model/monitorRepository.ts
import { MonitorModel } from "./monitorModel.js";
import { MonitorRow } from "./monitorRow.js";
import { MonitorSignal } from "./monitorSignal.js";
import { RingBuffer } from "../oscilloscope/ringBuffer.js";
import { Parameter } from "../iniParser.js"; 

export class MonitorRepository {
    
    public buildModel(parameters: Parameter[], bufferSize: number = 2500): MonitorModel {
        const model = new MonitorModel();

        for (const param of parameters) {
            const buffer = new RingBuffer(bufferSize);

            const regAddressNum = parseInt(param.regAddress, 10);
            const multiplierNum = parseFloat(param.multiplier.replace(',', '.'));

            const signal: MonitorSignal = {
                id: param.hexAddress || param.name,
                name: param.name,
                description: param.description,
                dataType: param.dataType,
                register: isNaN(regAddressNum) ? 0 : regAddressNum, 
                unit: param.unit,
                multiplier: isNaN(multiplierNum) ? 1.0 : multiplierNum, 
                buffer: buffer,
                currentValue: 0
            };

            const row = new MonitorRow(signal);
            model.addRow(row);
        }

        return model;
    }
}