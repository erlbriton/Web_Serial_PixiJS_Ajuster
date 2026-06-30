const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0;

// 1. Определение функции ДО использования
function showIdModal(text) {
    const existing = document.querySelector('.id-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'id-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'id-modal';
    
    // Текст и кнопка в одном контейнере
    modal.innerHTML = `
        <div class="id-modal-content">
            <span class="id-modal-text">${text}</span>
            <button class="id-modal-btn">OK</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('.id-modal-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

try {
    console.log("Зашел в try")
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();

    const idBtn = document.getElementById("idBtn");

    // 2. Исправленный обработчик кнопки ID
    if (idBtn) {
        console.log("idBtn = 1")
        idBtn.addEventListener("click", async () => {
            console.log("idBtn = 1 (Клик получен)");
            if (serial.isConnected) {
                console.log("isConnected = 1")
                showIdModal("Порт уже открыт!");
                return;
            }

            try {
                //showIdModal("Выберите порт...");
                await serial.connect(115200);
                
                const modal = document.querySelector('.id-modal-overlay');
                if (modal) modal.remove();
                
                console.log("Порт успешно открыт.");
            } catch (error) {
                console.error("Ошибка подключения:", error.message);
                const modalText = document.querySelector('.id-modal-text');
                if (modalText) modalText.textContent = "Ошибка: " + error.message;
            }
        });
    }

    let isPolling = false;

    async function readLoop() {
        while (serial.isConnected && isPolling) {
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
        while (serial.isConnected && isPolling) {
            const body = new Uint8Array([
                SLAVE_ADDRESS, 0x03, 
                (REGISTER_ADDR >> 8) & 0xFF, REGISTER_ADDR & 0xFF, 
                0x00, 0x46 
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
            await new Promise(res => setTimeout(res, 20));
        }
    }

    function handleValidPacket(packetData) {
        if (!Array.isArray(packetData)) return;
        const now = performance.now();
        if (lastPacketTime !== 0) {
            if (now - lastLogTime > 1000) {
                console.log("Последний интервал: " + Math.round(now - lastPacketTime) + " мс");
                lastLogTime = now;
            }
        }
        lastPacketTime = now;
        for (let i = 0; i < 70; i++) {
            buffers[i].push(packetData[i] || 0);
        }
        view.draw(buffers); 
    }

    const toggleOscBtn = document.getElementById('toggleOscBtn');
    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) {
                console.warn("Порт не открыт!");
                return;
            }
            isPolling = !isPolling;
            if (isPolling) {
                readLoop(); 
                writeLoop();
            }
        });
    }

} catch (error) {
    console.error("Ошибка инициализации:", error.message);
}