const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9kyQu5_1Ac6ea5bkVvWVy-_HbN43tC919Xf9sHP91Bt6LI7ggnCmUFoa_NbnVxGR5TKrVUJQwd6y1/pub?gid=0&single=true&output=csv';

const CELL_WIDTH = 60; // Must match CSS --cell-width
const START_HOUR = 17; // Shift starts at 17:00
const END_HOUR = 12;   // Shift ends at 12:00 next day
const TOTAL_HOURS = 20; // 17:00 to 12:00 is 20 hours

// Convert "HH:MM" string to relative hours from 17:00
function timeToRelativeHours(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const hr = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (isNaN(hr) || isNaN(min)) return null;
    
    const timeVal = hr + min / 60;
    
    // แบ่งช่วงเวลาให้ชัดเจน: 12:00 ถึง 16:59 ถือเป็นรถที่มาก่อนเวลา (Early arrival สำหรับกะนี้)
    if (timeVal >= 12 && timeVal < 17) {
        return timeVal - START_HOUR; // จะได้ค่าติดลบ กราฟจะเริ่มจากขอบซ้าย
    } else if (timeVal >= START_HOUR) {
        return timeVal - START_HOUR; // 17:00 ถึง 23:59
    } else {
        // ข้ามวัน (00:00 to 11:59)
        return timeVal + (24 - START_HOUR);
    }
}

// Robust CSV Parser (รองรับการมีลูกน้ำหรือ Comma ในข้อความ)
function parseCSV(text) {
    // ลบ Carriage Returns (\r) ที่มักจะติดมาจากฝั่ง Windows/Excel
    text = text.replace(/\r/g, ''); 
    const lines = text.split('\n');
    const result = [];

    for (let line of lines) {
        if (line.trim() === '') continue;
        const row = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    currentCell += '"'; // Escaped quote
                    i++;
                } else {
                    inQuotes = !inQuotes; // Toggle quotes
                }
            } else if (char === ',' && !inQuotes) {
                row.push(currentCell.trim());
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        row.push(currentCell.trim());
        result.push(row);
    }
    return result;
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
                status: r[0] || 'Unknown',
                standby: r[1] || '',
                loading: r[2] || '',
                depart: r[3] || '',
                dest: r[4] || 'Unknown',
                type: r[5] || 'Unknown'
            };
        }).filter(r => r.dest && r.dest !== 'Unknown' && r.loading !== 'เวลาเข้า'); 
        // เปลี่ยนมา Filter ให้แสดงแถวที่มีข้อมูลปลายทาง แม้รถจะยังไม่มีเวลา Depart ก็ตาม
        
        renderTimeline(scheduleData);
    } catch (e) {
        console.error("Error loading data:", e);
        document.getElementById('timelineContainer').innerHTML = `<div style="padding:20px;color:red;">Failed to load data. Please check console.</div>`;
    }
}

function renderTimeline(data) {
    if(data.length === 0) return;
    
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
        
        html += `<tr class="time-row">`;
        html += `<td class="col-dest" title="${item.dest}">${item.dest} <br><small style="color:#64748b;font-weight:normal">${item.type}</small></td>`;
        
        // Render time cells
        for(let i = 0; i < TOTAL_HOURS; i++) {
            if (i === 0) {
                html += `<td class="time-cell grid-line" style="position: relative;">`;
                
                // ถ้ารถมีการเข้าโหลด (Loading) ให้วาดกราฟ
                if (loadingRel !== null) {
                    const leftPx = loadingRel * CELL_WIDTH;
                    let widthPx = CELL_WIDTH; // ความกว้างเริ่มต้นถ้ารถยังไม่ออก (1 ชั่วโมง)
                    let displayDepart = item.depart || 'ยังไม่ออก';
                    
                    if (departRel !== null) {
                        widthPx = (departRel - loadingRel) * CELL_WIDTH;
                        if (widthPx < 0) widthPx = Math.abs(widthPx); // ป้องกันบัคความกว้างติดลบถ้ากรอกเวลาผิด
                        if (widthPx === 0) widthPx = 20; // ถ้าเข้าและออกเวลาเดียวกัน ให้แสดงขีดบางๆ
                    }
                    
                    // เช็คครอบคลุมทั้งคำว่า Arrived และภาษาไทย
                    const isArrived = item.status.toLowerCase().includes('arrived') || item.status.includes('ถึง');
                    const barClass = isArrived ? 'status-arrived' : 'status-not-arrived';
                    const label = isArrived ? 'Arrived' : 'Not Arrived';
                    const tooltipText = `ประเภทรถ: ${item.type} | สถานะ: ${label} | Loading: ${item.loading} - Depart: ${displayDepart}`;
                    
                    html += `<div class="gantt-bar ${barClass}" 
                                  style="left: ${leftPx}px; width: ${widthPx}px;"
                                  data-tooltip="${tooltipText}">
                                  <span class="bar-text">${item.loading} - ${displayDepart}</span>
                             </div>`;
                }
                         
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
