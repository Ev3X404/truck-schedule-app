const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9kyQu5_1Ac6ea5bkVvWVy-_HbN43tC919Xf9sHP91Bt6LI7ggnCmUFoa_NbnVxGR5TKrVUJQwd6y1/pub?gid=0&single=true&output=csv';

const CELL_WIDTH = 60; // Must match CSS --cell-width
const START_HOUR = 17; // Shift starts at 17:00
const END_HOUR = 12;   // Shift ends at 12:00 next day
const TOTAL_HOURS = 20; // 17:00 to 12:00 is 20 hours

// Convert "HH:MM" string to relative hours from 17:00
function timeToRelativeHours(timeStr) {
    if (!timeStr) return null;
    // ป้องกัน Error หากข้อมูลไม่ใช่ String
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return null;
    const hr = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (isNaN(hr) || isNaN(min)) return null;
    
    const timeVal = hr + min / 60;
    
    // แก้บัคกราฟทะลุขอบขวา: ถ้ารถมาก่อน 17:00 ให้กราฟวาดไปทางซ้าย (ค่าติดลบ)
    if (timeVal >= 12 && timeVal < 17) {
        return timeVal - START_HOUR; 
    } else if (timeVal >= START_HOUR) {
        return timeVal - START_HOUR; // 17:00 ถึง 23:59
    } else {
        return timeVal + (24 - START_HOUR); // ข้ามวัน (00:00 ถึง 11:59)
    }
}

// ใช้ Parser ตัวเดิมของคุณที่เข้ากับโครงสร้าง Google Sheets ได้ดีเยี่ยมอยู่แล้ว
function parseCSV(text) {
    let lines = text.split('\n');
    return lines.filter(line => line.trim() !== '').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
}

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        const text = await response.text();
        const data = parseCSV(text);
        
        // Remove header
        const rows = data.slice(1);
        
        const scheduleData = rows.map(r => {
            return {
                status: r[0] || '',
                standby: r[1] || '',
                loading: r[2] || '',
                depart: r[3] || '',
                dest: r[4] || 'Unknown',
                type: r[5] || ''
            };
        }).filter(r => r.loading && r.loading.trim() !== '' && r.loading !== 'เวลาเข้า'); 
        // ^ แก้บัคที่ 1: กรองเอาเฉพาะคันที่เริ่ม "โหลดของแล้ว" เท่านั้น เพื่อซ่อนแถวว่าง 
        // และถอดเงื่อนไข r.depart ออก เพื่อให้รถที่กำลังโหลดและยังไม่ออก แสดงอยู่บนจอได้
        
        renderTimeline(scheduleData);
    } catch (e) {
        console.error("Error loading data:", e);
        document.getElementById('timelineContainer').innerHTML = `<div style="padding:20px;color:red;">Failed to load data. Please check console.</div>`;
    }
}

function renderTimeline(data) {
    if(data.length === 0) {
        document.getElementById('timelineContainer').innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">ไม่มีข้อมูลตารางเดินรถในขณะนี้</div>`;
        return;
    }
    
    let html = `<table class="schedule-table">`;
    
    // 1. Header
    html += `<thead><tr>`;
    html += `<th class="col-dest">ปลายทาง (Destination)</th>`;
    for(let i = 0; i < TOTAL_HOURS; i++) {
        let displayHour = (START_HOUR + i) % 24;
        html += `<th class="time-cell">${displayHour.toString().padStart(2, '0')}:00</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    data.forEach((item, index) => {
        const loadingRel = timeToRelativeHours(item.loading);
        const departRel = timeToRelativeHours(item.depart);
        
        // ถ้าค่าเวลาผิดพลาดให้ข้ามไป
        if (loadingRel === null) return;
        
        html += `<tr class="time-row">`;
        html += `<td class="col-dest" title="${item.dest}">${item.dest} <br><small style="color:#64748b;font-weight:normal">${item.type}</small></td>`;
        
        // Render time cells
        for(let i = 0; i < TOTAL_HOURS; i++) {
            if (i === 0) {
                html += `<td class="time-cell grid-line" style="position: relative;">`;
                
                const leftPx = loadingRel * CELL_WIDTH;
                let widthPx = CELL_WIDTH; // ความกว้างตั้งต้น
                let displayDepart = item.depart || 'กำลังโหลด...';
                
                if (departRel !== null) {
                    widthPx = (departRel - loadingRel) * CELL_WIDTH;
                    // แก้บัคที่ 2: ป้องกันความกว้างกราฟติดลบ กรณีคนพิมพ์เวลาออกน้อยกว่าเวลาเข้า
                    if (widthPx < 0) widthPx = Math.abs(widthPx);
                    if (widthPx === 0) widthPx = 20; // กรณีเข้าและออกนาทีเดียวกัน ให้เป็นขีดบางๆ
                }
                
                // แก้บัคที่ 3: รองรับสถานะภาษาไทย และป้องกันแอปพังถ้าไม่ได้กรอก Status
                const statusStr = String(item.status).toLowerCase();
                const isArrived = statusStr.includes('arrived') || statusStr.includes('ถึง');
                const barClass = isArrived ? 'status-arrived' : 'status-not-arrived';
                const label = isArrived ? 'Arrived' : 'Not Arrived';
                const tooltipText = `ประเภทรถ: ${item.type || '-'} | สถานะ: ${label} | Loading: ${item.loading} - Depart: ${displayDepart}`;
                
                html += `<div class="gantt-bar ${barClass}" 
                              style="left: ${leftPx}px; width: ${widthPx}px;"
                              data-tooltip="${tooltipText}">
                              <span class="bar-text">${item.loading} - ${displayDepart}</span>
                         </div>`;
                         
                html += `</td>`;
            } else {
                html += `<td class="time-cell grid-line"></td>`;
            }
        }
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    
    document.getElementById('timelineContainer').innerHTML = html;
}

setInterval(loadData, 60000);
loadData();
