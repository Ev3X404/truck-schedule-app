const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9kyQu5_1Ac6ea5bkVvWVy-_HbN43tC919Xf9sHP91Bt6LI7ggnCmUFoa_NbnVxGR5TKrVUJQwd6y1/pub?gid=0&single=true&output=csv';

const CELL_WIDTH = 60; 
const START_HOUR = 17; 
const END_HOUR = 12;   
const TOTAL_HOURS = 20; 

function timeToRelativeHours(timeStr) {
    if (!timeStr) return null;
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return null;
    const hr = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (isNaN(hr) || isNaN(min)) return null;
    
    const timeVal = hr + min / 60;
    
    if (timeVal >= 12 && timeVal < 17) {
        return timeVal - START_HOUR; 
    } else if (timeVal >= START_HOUR) {
        return timeVal - START_HOUR; 
    } else {
        return timeVal + (24 - START_HOUR); 
    }
}

function parseCSV(text) {
    let lines = text.split('\n');
    return lines.filter(line => line.trim() !== '').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
}

// ฟังก์ชันจัดรูปแบบเวลาสำหรับโชว์ Last Updated
function formatCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0') + ':' + 
           now.getSeconds().toString().padStart(2, '0');
}

// อัปเดตสถานะการเชื่อมต่อบนหน้าจอ
function updateStatusBadge(isSuccess) {
    const badge = document.getElementById('lastUpdated');
    if (!badge) return;
    
    if (isSuccess) {
        badge.innerText = 'อัปเดตล่าสุด: ' + formatCurrentTime();
        badge.style.backgroundColor = '#e0f2fe';
        badge.style.color = '#0369a1';
    } else {
        badge.innerText = 'ขาดการเชื่อมต่อ กำลังลองใหม่...';
        badge.style.backgroundColor = '#fee2e2';
        badge.style.color = '#ef4444';
    }
}

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        const text = await response.text();
        const data = parseCSV(text);
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
        
        renderTimeline(scheduleData);
        updateStatusBadge(true); // แจ้งเตือนว่าโหลดสำเร็จ
    } catch (e) {
        console.error("Error loading data:", e);
        updateStatusBadge(false); // เน็ตหลุด แต่ไม่ลบตารางทิ้ง!
    }
}

function renderTimeline(data) {
    if(data.length === 0) {
        document.getElementById('timelineContainer').innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">ไม่มีข้อมูลตารางเดินรถในขณะนี้</div>`;
        return;
    }
    
    let html = `<table class="schedule-table">`;
    html += `<thead><tr>`;
    html += `<th class="col-dest">ปลายทาง (Destination)</th>`;
    for(let i = 0; i < TOTAL_HOURS; i++) {
        let displayHour = (START_HOUR + i) % 24;
        html += `<th class="time-cell">${displayHour.toString().padStart(2, '0')}:00</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    data.forEach((item) => {
        const loadingRel = timeToRelativeHours(item.loading);
        const departRel = timeToRelativeHours(item.depart);
        
        if (loadingRel === null) return;
        
        html += `<tr class="time-row">`;
        html += `<td class="col-dest" title="${item.dest}">${item.dest} <br><small style="color:#64748b;font-weight:normal">${item.type}</small></td>`;
        
        for(let i = 0; i < TOTAL_HOURS; i++) {
            if (i === 0) {
                html += `<td class="time-cell grid-line" style="position: relative;">`;
                
                const leftPx = loadingRel * CELL_WIDTH;
                let widthPx = CELL_WIDTH; 
                let displayDepart = item.depart || 'กำลังโหลด...';
                
                if (departRel !== null) {
                    widthPx = (departRel - loadingRel) * CELL_WIDTH;
                    if (widthPx < 0) widthPx = Math.abs(widthPx);
                    if (widthPx === 0) widthPx = 20; 
                }
                
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
    
    // เรียกใช้วาดเส้นเวลา หลังจากสร้างตารางเสร็จ
    drawCurrentTimeLine();
}

// ----------------------------------------------------
// ฟีเจอร์วาดเส้นบอกเวลาปัจจุบัน (Current Time Indicator)
// ----------------------------------------------------
function drawCurrentTimeLine() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    let line = document.getElementById('currentTimeIndicator');
    if (!line) {
        line = document.createElement('div');
        line.id = 'currentTimeIndicator';
        line.className = 'time-indicator';
        container.appendChild(line);
    }

    // หาตำแหน่งเริ่มต้นจากหัวตารางคอลัมน์เวลาแรกสุด
    const firstTimeCell = document.querySelector('thead th.time-cell');
    const table = document.querySelector('.schedule-table');
    if (!firstTimeCell || !table) return;

    const baseLeft = firstTimeCell.offsetLeft;
    const now = new Date();
    const timeVal = now.getHours() + (now.getMinutes() / 60);

    let relativeTime = null;
    if (timeVal >= 12 && timeVal < 17) {
        relativeTime = timeVal - 17;
    } else if (timeVal >= 17) {
        relativeTime = timeVal - 17;
    } else {
        relativeTime = timeVal + (24 - 17);
    }

    // กำหนดให้เส้นขยับและมีความสูงเท่ากับตัวตาราง
    line.style.display = 'block';
    line.style.left = (baseLeft + (relativeTime * CELL_WIDTH)) + 'px';
    line.style.height = table.offsetHeight + 'px';
}

// อัปเดตข้อมูลทุก 60 วินาที
setInterval(loadData, 60000);
// อัปเดตเส้นเวลาให้ขยับเองทุก 1 นาที (โดยไม่ต้องโหลดข้อมูลใหม่เผื่อเน็ตหลุด)
setInterval(drawCurrentTimeLine, 60000); 
// คำนวณเส้นใหม่เสมอเมื่อมีการย่อ/ขยายหน้าจอ
window.addEventListener('resize', drawCurrentTimeLine);

// โหลดครั้งแรก
loadData();
