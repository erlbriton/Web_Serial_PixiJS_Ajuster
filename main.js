const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0; // Для контроля частоты вывода в консоль

try {
    const view = new PixiOscilloscope("osc-container");
    
    // Создаем массив из 70 независимых буферов
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(1000));
    
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const connectBtn = document.getElementById("connectBtn");

    connectBtn.addEventListener("click", async () => {
        try {
            await serial.connect(115200);
            connectBtn.textContent = "ПОДКЛЮЧЕНО";
            readLoop();   
            writeLoop();  
        } catch (error) {
            console.error("Ошибка:", error.message);
        }
    });

    async function readLoop() {
        while (serial.isConnected) {
            const chunk = await serial.readChunk();
            if (!chunk) break;
            parser.appendData(chunk);

            let packetData = parser.parsePacket();
            while (packetData !== null) {
                handleValidPacket(packetData);
                packetData = parser.parsePacket();
            }
        }
    }

    async function writeLoop() {
        while (serial.isConnected) {
            const body = new Uint8Array([
                SLAVE_ADDRESS, 
                0x03,                           
                (REGISTER_ADDR >> 8) & 0xFF,    
                REGISTER_ADDR & 0xFF,           
                0x00, 0x46 // Запрашиваем ровно 70 регистров (0x46 = 70)
            ]);

            let crc = 0xFFFF;
            for (let pos = 0; pos < body.length; pos++) {
                crc ^= body[pos];
                for (let i = 8; i !== 0; i--) {
                    if ((crc & 0x0001) !== 0) { crc >>= 1; crc ^= 0xA001; } else { crc >>= 1; }
                }
            }

            const finalPacket = new Uint8Array(8);
            finalPacket.set(body, 0);
            finalPacket[6] = crc & 0xFF;        
            finalPacket[7] = (crc >> 8) & 0xFF; 

            await serial.write(finalPacket);
            await new Promise(res => setTimeout(res, 20)); // Опрос 30мс
        }
    }

    function handleValidPacket(packetData) {
    if (!Array.isArray(packetData)) return;

    // Считаем интервал
    const now = performance.now();
    if (lastPacketTime !== 0) {
        const interval = Math.round(now - lastPacketTime);
        
        // Выводим в консоль только если прошла 1 секунда (1000 мс)
        if (now - lastLogTime > 1000) {
            console.log("Последний интервал: " + interval + " мс");
            lastLogTime = now;
        }
    }
    lastPacketTime = now;

    // Распределяем данные
    for (let i = 0; i < 70; i++) {
        buffers[i].push(packetData[i] || 0);
    }

    // Отрисовка
    view.draw(buffers); 
}

} catch (error) {
    console.error("Ошибка инициализации:", error.message);
}