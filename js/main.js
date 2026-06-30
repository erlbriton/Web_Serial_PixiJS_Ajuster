const SLAVE_ADDRESS = 0x01;
const REGISTER_ADDR = 0x0000;

let lastPacketTime = 0;
let lastLogTime = 0;

function showIdModal(text) {
    const existing = document.querySelector('.id-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'id-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'id-modal';
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
    const view = new PixiOscilloscope("osc-container");
    const buffers = Array.from({ length: 70 }, () => new RingBuffer(2500));
    const serial = new SerialConnection();
    const parser = new ModbusParser();
    const idBtn = document.getElementById("idBtn");

   if (idBtn) {
        idBtn.addEventListener("click", async () => {
            if (serial.isConnected) {
                showIdModal("Порт уже открыт!");
                return;
            }

            try {
                showIdModal("Запрос ID...");
                await serial.connect(115200);
                
                // 1. Отправляем команду
                const packet = new Uint8Array([0x01, 0x11, 0xC0, 0x1C]);
                await serial.write(packet);
                console.log("Команда ID отправлена");

                // 2. ОДНОКРАТНОЕ ЧТЕНИЕ ОТВЕТА (прямо здесь, не дожидаясь Toggle)
                const startTime = Date.now();
                let found = false;
                while (Date.now() - startTime < 1000) {
                    const chunk = await serial.readChunk();
                    if (chunk && chunk[0] === 0x01 && chunk[1] === 0x11) {
                        const dataLength = chunk[2];
                        let str = "";
                        for (let i = 3; i < 3 + dataLength; i++) {
                            if (chunk[i] > 0) str += String.fromCharCode(chunk[i]);
                        }
                        const idSpan = document.querySelector('.id-banner span');
                        if (idSpan) idSpan.textContent = str.trim();
                        
                        const modal = document.querySelector('.id-modal-overlay');
                        if (modal) modal.remove();
                        
                        console.log("ID получен:", str.trim());
                        found = true;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 50));
                }
                
                if (!found) console.warn("Ответ на запрос ID не получен за 1 секунду");
                
            } catch (error) {
                console.error("Ошибка:", error.message);
                showIdModal("Ошибка: " + error.message);
            }
        });
    }

    let isPolling = false;

    async function readLoop() {
        while (serial.isConnected && isPolling) {
            const chunk = await serial.readChunk();
            if (!chunk) break;
            
            // Если это ответ на ID (начинается с 0x01, 0x11), парсим его отдельно
            if (chunk[0] === 0x01 && chunk[1] === 0x11) {
                const dataLength = chunk[2];
                let str = "";
                for (let i = 3; i < 3 + dataLength; i++) {
                    if (chunk[i] > 0) str += String.fromCharCode(chunk[i]);
                }
                const idSpan = document.querySelector('.id-banner span');
                if (idSpan) idSpan.textContent = str.trim();
                const modal = document.querySelector('.id-modal-overlay');
                if (modal) modal.remove();
            } else {
                // Иначе передаем в основной парсер данных
                parser.appendData(chunk);
                let packetData = parser.parsePacket();
                while (packetData !== null) {
                    handleValidPacket(packetData);
                    packetData = parser.parsePacket();
                }
            }
        }
    }

    async function writeLoop() {
        while (serial.isConnected && isPolling) {
            const body = new Uint8Array([SLAVE_ADDRESS, 0x03, (REGISTER_ADDR >> 8) & 0xFF, REGISTER_ADDR & 0xFF, 0x00, 0x46]);
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
        if (lastPacketTime !== 0 && now - lastLogTime > 1000) {
            console.log("Последний интервал: " + Math.round(now - lastPacketTime) + " мс");
            lastLogTime = now;
        }
        lastPacketTime = now;
        for (let i = 0; i < 70; i++) buffers[i].push(packetData[i] || 0);
        view.draw(buffers); 
    }

    const toggleOscBtn = document.getElementById('toggleOscBtn');
    if (toggleOscBtn) {
        toggleOscBtn.addEventListener('click', () => {
            if (!serial.isConnected) return;
            isPolling = !isPolling;
            if (isPolling) { readLoop(); writeLoop(); }
        });
    }
} catch (error) {
    console.error("Ошибка инициализации:", error.message);
}