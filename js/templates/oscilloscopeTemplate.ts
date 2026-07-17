export const OSCILLOSCOPE_TEMPLATE = `
<div class="osc-toolbar">
    <button class="osc-btn" title="Свойства"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.98C19.47,12.66 19.5,12.34 19.5,12C19.5,11.66 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.65 15.48,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.52,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.66 4.57,12.98L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.04 4.95,18.95L7.44,17.95C7.96,18.35 8.52,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.48,18.68 16.04,18.34 16.56,17.95L19.05,18.95C19.27,19.04 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.98Z"/></svg></button>
    <button class="osc-btn" title="Пауза - Пуск"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8,19V5L14,12L8,19M16,5H18V19H16V5Z" /></svg></button>
    <button class="osc-btn" title="REC"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"/><circle cx="12" cy="12" r="5" fill="#ff4444"/></svg></button>
    <button class="osc-btn" title="Масштаб"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></svg></button>
    <button class="osc-btn" title="Измерение временных интервалов"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 12l-4-4v3H6V8L2 12l4 4v-3h12v3l4-4z"/></svg></button>
    <button class="osc-btn" title="Измерение амплитуды сигнала"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L8 6h3v12H8l4 4 4-4h-3V6h3l-4-4z"/></svg></button>
</div>

<div class="osc-main-area">
    <div class="osc-table-wrapper" id="osc-left-panel">
        <table class="osc-data-grid">
            <colgroup>
                <col class="col-name"><col class="col-hex"><col class="col-phys"><col class="col-unit">
            </colgroup>
            <thead>
                <tr>
                    <th class="header-cell">Name</th>
                    <th class="header-cell">Hex</th>
                    <th class="header-cell">Physical</th>
                    <th class="header-cell">Unit</th>
                </tr>
            </thead>
            <tbody id="osc-grid-body"></tbody>
        </table>
    </div>
    <div class="osc-main-splitter" id="osc-panel-splitter"></div>
    <div class="osc-graph-wrapper" id="osc-graph-wrapper">
        <div class="osc-canvas-header">Graph</div>
        <div id="osc-canvas-container"></div>
    </div>
</div>`;