const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9kyQu5_1Ac6ea5bkVvWVy-_HbN43tC919Xf9sHP91Bt6LI7ggnCmUFoa_NbnVxGR5TKrVUJQwd6y1/pub?gid=0&single=true&output=csv'; // Can be replaced with Google Sheets CSV URL later
// const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-xxxxxx/pub?gid=0&single=true&output=csv';

const CELL_WIDTH = 60; // Must match CSS --cell-width

// Utility to convert Excel fractional time to HH:MM string
function formatTime(frac) {
    if (frac === undefined || frac === null || frac === '') return '';
    let totalMinutes = Math.round(frac * 24 * 60);
    let hours = Math.floor(totalMinutes / 60) % 24;
    let minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Handle cross-midnight logic: assuming schedule starts around 18:00 and ends around 14:00 next day.
// Times < 0.6 (14:24) are considered "next day" and get +1 for plotting purposes.
function adjustFrac(frac) {
    const f = parseFloat(frac);
    if (isNaN(f)) return null;
    return f < 0.6 ? f + 1 : f;
}

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        const data = await response.json(); // Assuming JSON. For CSV, we'd use a simple CSV parser.
        
        // Remove header
        const rows = data.slice(1);
        
        const scheduleData = rows.map(r => {
            return {
                status: r[0] || 'Unknown',
                standby: adjustFrac(r[1]),
                loading: adjustFrac(r[2]),
                depart: adjustFrac(r[3]),
                dest: r[4] || 'Unknown',
                type: r[5]
            };
        }).filter(r => r.loading !== null && r.depart !== null); // Only keep rows with valid loading/depart times
        
        renderTimeline(scheduleData);
    } catch (e) {
        console.error("Error loading data:", e);
        document.getElementById('timelineContainer').innerHTML = `<div style="padding:20px;color:red;">Failed to load data. Please check console.</div>`;
    }
}

function renderTimeline(data) {
    if(data.length === 0) return;

    // Find min and max time to define timeline range
    let minTime = Math.min(...data.map(d => d.loading));
    let maxTime = Math.max(...data.map(d => d.depart));
    
    // Expand bounds to nearest hours
    let startHour = Math.floor(minTime * 24) - 1; 
    let endHour = Math.ceil(maxTime * 24) + 1;
    
    const totalHours = endHour - startHour;
    
    // Build HTML
    let html = `<table class="schedule-table">`;
    
    // 1. Header
    html += `<thead><tr>`;
    html += `<th class="col-dest">ปลายทาง (Destination)</th>`;
    for(let i = 0; i < totalHours; i++) {
        let displayHour = (startHour + i) % 24;
        html += `<th class="time-cell">${displayHour.toString().padStart(2, '0')}:00</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    // 2. Rows
    // Group by destination to simplify, or just render each row. The image has multiple trucks per destination.
    // Let's render each truck as a separate row for now, or group them if desired. 
    // The user requested: "ความยาวกราฟที่แสดงนั้น ยาวจากเวลาที่ Loading ถึง เวลาที่ departed ถ้ารอบเวลาดังกล่าวมีรถมาแล้วให้แสดงกราฟเป็นสีฟ้า ถ้ายังไม่มีรถมาให้เป็นสีเทา"
    
    data.forEach((item, index) => {
        html += `<tr class="time-row">`;
        html += `<td class="col-dest" title="${item.dest}">${item.dest} <br><small style="color:#64748b;font-weight:normal">${item.type}</small></td>`;
        
        // Render time cells
        for(let i = 0; i < totalHours; i++) {
            // Put the bar wrapper inside the first time cell of the row
            if (i === 0) {
                html += `<td class="time-cell grid-line" style="position: relative;">`;
                
                const leftPx = ((item.loading * 24) - startHour) * CELL_WIDTH;
                const widthPx = ((item.depart - item.loading) * 24) * CELL_WIDTH;
                
                const isArrived = item.status.toLowerCase().includes('arrived');
                const barClass = isArrived ? 'status-arrived' : 'status-not-arrived';
                const label = isArrived ? 'Arrived' : 'Not Arrived';
                
                html += `<div class="gantt-bar ${barClass}" 
                              style="left: ${leftPx}px; width: ${widthPx}px;"
                              title="${label} | Loading: ${formatTime(item.loading)} - Depart: ${formatTime(item.depart)}">
                              ${formatTime(item.loading)} - ${formatTime(item.depart)}
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

// Auto-refresh every 60 seconds (useful for real-time when hooked to Google Sheets)
setInterval(loadData, 60000);

// Initial load
loadData();
