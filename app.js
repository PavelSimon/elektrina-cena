let chart;

// Plugin to draw weekend backgrounds
const weekendBackgroundPlugin = {
    id: 'weekendBackground',
    beforeDraw: (chart) => {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        const meta = chart.getDatasetMeta(0);

        if (!meta || !meta.data || meta.data.length === 0) return;

        ctx.save();

        const data = chart.data.datasets[0]._weekendData || [];

        data.forEach(weekend => {
            if (weekend.startIndex !== undefined && weekend.endIndex !== undefined) {
                const startPoint = meta.data[weekend.startIndex];
                // Step chart: the last interval runs up to the following point
                const endPoint = meta.data[weekend.endIndex + 1] || meta.data[weekend.endIndex];

                if (startPoint && endPoint) {
                    const x1 = startPoint.x;
                    const x2 = endPoint.x;

                    ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
                    ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
                }
            }
        });

        ctx.restore();
    }
};

// Plugin to draw dashed vertical hour/sub-day gridlines
const hourGridPlugin = {
    id: 'hourGrid',
    beforeDatasetsDraw: (chart) => {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || meta.data.length === 0) return;
        const cfg = chart.data.datasets[0]._hourGrid;
        if (!cfg || !cfg.stepMinutes) return;

        const ctx = chart.ctx;
        const area = chart.chartArea;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        cfg.data.forEach((entry, i) => {
            const period = parseInt(entry.period);
            if (period === 1) return; // day boundary
            // draw a line where the interval starts on a multiple of `stepMinutes`
            if (cfg.minutes[i] % cfg.stepMinutes !== 0) return;
            const point = meta.data[i];
            if (!point) return;
            ctx.beginPath();
            ctx.moveTo(point.x, area.top);
            ctx.lineTo(point.x, area.bottom);
            ctx.stroke();
        });

        ctx.restore();
    }
};

// Interaction mode for the step chart: pick the interval the cursor is in
// (the point at or left of the cursor), not the nearest point.
Chart.Interaction.modes.stepInterval = function (chart, e) {
    const area = chart.chartArea;
    const count = chart.data.labels.length;
    if (count < 2 || e.x < area.left || e.x > area.right || e.y < area.top || e.y > area.bottom) {
        return [];
    }
    const xScale = chart.scales.x;
    let index = Math.floor(((e.x - xScale.left) / xScale.width) * (count - 1));
    index = Math.max(0, Math.min(count - 2, index)); // last point only closes the final step

    const items = [];
    chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!chart.isDatasetVisible(datasetIndex)) return;
        const element = chart.getDatasetMeta(datasetIndex).data[index];
        if (element && index < dataset.data.length - 1) {
            items.push({ element, datasetIndex, index });
        }
    });
    return items;
};

// Local (Slovak) HH:MM of a delivery timestamp; OKTE sends them in UTC.
const localTimeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bratislava', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// Start and end of the delivery interval as HH:MM. Uses the real timestamps,
// so hourly data (before 2025-10-01), 15-minute data and clock-change days
// are all labelled correctly. Falls back to 15-minute slots without them.
function intervalTimes(entry) {
    if (entry.deliveryStart && entry.deliveryEnd) {
        return {
            start: localTimeFormat.format(new Date(entry.deliveryStart)),
            end: localTimeFormat.format(new Date(entry.deliveryEnd))
        };
    }
    const toTime = (slot) => {
        const h = Math.floor(slot / 4) % 24;
        return `${String(h).padStart(2, '0')}:${String((slot % 4) * 15).padStart(2, '0')}`;
    };
    const p = parseInt(entry.period);
    return { start: toTime(p - 1), end: toTime(p) };
}

// Load dates from URL parameters on page load
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const startDate = urlParams.get('start_date');
    const endDate = urlParams.get('end_date');

    // Optional comparison period: one of comp_start / comp_end
    const compStart = urlParams.get('comp_start');
    const compEnd = urlParams.get('comp_end');
    if (compStart) {
        compAnchor = { type: 'start', date: compStart };
    } else if (compEnd) {
        compAnchor = { type: 'end', date: compEnd };
    }

    if (startDate && endDate) {
        document.getElementById('start_date').value = startDate;
        document.getElementById('end_date').value = endDate;
        document.getElementById('dataForm').requestSubmit();
    }
});

// Comparison period. null = automatic (the interval right before the main
// one); otherwise the date the user entered and which end of the period it is.
// The other end is always derived from the length of the main interval.
let compAnchor = null;

function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function comparisonPeriod(mainStart, intervalDays) {
    if (!compAnchor) {
        const end = addDays(mainStart, -1);
        return { start: addDays(end, -(intervalDays - 1)), end };
    }
    if (compAnchor.type === 'start') {
        return { start: compAnchor.date, end: addDays(compAnchor.date, intervalDays - 1) };
    }
    return { start: addDays(compAnchor.date, -(intervalDays - 1)), end: compAnchor.date };
}

// Show the period actually used in the two inputs and say how it was derived
function showComparisonPeriod(period) {
    document.getElementById('comp_start').value = period.start;
    document.getElementById('comp_end').value = period.end;
    document.getElementById('compareRow').classList.toggle('auto', !compAnchor);
    document.getElementById('compHint').textContent = !compAnchor
        ? 'automaticky: obdobie tesne pred hlavným'
        : (compAnchor.type === 'start'
            ? 'zadaný začiatok, koniec dopočítaný podľa dĺžky hlavného obdobia'
            : 'zadaný koniec, začiatok dopočítaný podľa dĺžky hlavného obdobia');
}

function redrawIfReady() {
    const form = document.getElementById('dataForm');
    if (form.checkValidity()) form.requestSubmit();
}

['start', 'end'].forEach((type) => {
    document.getElementById(`comp_${type}`).addEventListener('change', (e) => {
        // Emptying the field returns to the automatic period
        compAnchor = e.target.value ? { type, date: e.target.value } : null;
        redrawIfReady();
    });
});

document.getElementById('compAuto').addEventListener('click', () => {
    compAnchor = null;
    showComparisonPeriod({ start: '', end: '' });
    redrawIfReady();
});

// Day with the largest difference between its highest and lowest price
function maxDailySpread(rows) {
    const days = new Map();
    rows.forEach((entry) => {
        const day = days.get(entry.deliveryDay);
        if (!day) {
            days.set(entry.deliveryDay, { min: entry.price, max: entry.price });
        } else {
            day.min = Math.min(day.min, entry.price);
            day.max = Math.max(day.max, entry.price);
        }
    });
    let best = null;
    days.forEach((range, day) => {
        const spread = range.max - range.min;
        if (!best || spread > best.spread) {
            best = { day, spread, min: range.min, max: range.max };
        }
    });
    return best;
}

// Fills the "max daily spread" statistic; elementId/whenId are the two spans
function showSpread(elementId, whenId, rows) {
    const best = maxDailySpread(rows);
    document.getElementById(elementId).textContent = best ? best.spread.toFixed(2) : '';
    document.getElementById(whenId).textContent = best
        ? `(${best.day}: ${best.min.toFixed(2)} – ${best.max.toFixed(2)})`
        : '';
}

document.getElementById('dataForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const start_date = document.getElementById('start_date').value;
    const end_date = document.getElementById('end_date').value;

    const response = await fetch(`api.php?start_date=${start_date}&end_date=${end_date}`);
    const data = await response.json();

    if (data.error) {
        alert(`Error: ${data.error}`);
        return;
    }

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const intervalDays = Math.round((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

    const comparison = comparisonPeriod(start_date, intervalDays);
    showComparisonPeriod(comparison);
    const prevStartStr = comparison.start;
    const prevEndStr = comparison.end;

    const prevResponse = await fetch(`api.php?start_date=${prevStartStr}&end_date=${prevEndStr}`);
    const prevData = await prevResponse.json();

    const hasPrevData = !prevData.error && prevData.length > 0;

    const times = data.map(intervalTimes);
    // Minute of the day at which each interval starts (local time)
    const startMinutes = times.map(t => parseInt(t.start.slice(0, 2)) * 60 + parseInt(t.start.slice(3)));
    const intervalLabel = (entry, t) => `${entry.deliveryDay} ${t.start} – ${t.end}`;

    const labels = data.map((entry, i) => {
        if (parseInt(entry.period) === 1) return `${entry.deliveryDay}`;
        // Mark 06:00/12:00/18:00 when interval <3 days
        if (intervalDays < 3 && ['06:00', '12:00', '18:00'].includes(times[i].start)) {
            return times[i].start;
        }
        return '';
    });
    // Extra point that closes the last step, so the final interval is drawn
    // as a horizontal segment up to its end time.
    labels.push('');

    // Dashed sub-day gridlines: <3 days → every hour; <8 days → every 6 h; else off.
    const hourGridStepMinutes = intervalDays < 3 ? 60 : (intervalDays < 8 ? 360 : 0);

    const prices = data.map(entry => entry.price);
    const closeLastStep = (values) => values.length ? [...values, values[values.length - 1]] : values;

    const fullLabels = data.map((entry, i) => intervalLabel(entry, times[i]));

    const weekendData = [];
    let currentWeekend = null;

    data.forEach((entry, index) => {
        const date = new Date(entry.deliveryDay);
        const dayOfWeek = date.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (currentWeekend === null) {
                currentWeekend = { startIndex: index, endIndex: index };
            } else {
                currentWeekend.endIndex = index;
            }
        } else {
            if (currentWeekend !== null) {
                weekendData.push(currentWeekend);
                currentWeekend = null;
            }
        }
    });

    if (currentWeekend !== null) {
        weekendData.push(currentWeekend);
    }

    const datasets = [{
        label: `Aktuálne obdobie (${start_date} - ${end_date})`,
        data: closeLastStep(prices),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0,
        stepped: 'before', // Chart.js: hold each price until the next point (whole delivery interval)
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(75, 192, 192)',
        borderWidth: 1.5,
        spanGaps: false,
        _weekendData: weekendData,
        _hourGrid: { stepMinutes: hourGridStepMinutes, data: data, minutes: startMinutes }
    }];

    let prevFullLabels = [];
    if (hasPrevData) {
        const prevPrices = prevData.map(entry => entry.price);
        prevFullLabels = prevData.map(entry => intervalLabel(entry, intervalTimes(entry)));

        datasets.push({
            label: `Porovnávacie obdobie (${prevStartStr} - ${prevEndStr})`,
            data: closeLastStep(prevPrices),
            fill: false,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0,
            stepped: 'before',
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: 'rgb(255, 99, 132)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            spanGaps: false
        });
    }

    const ctx = document.getElementById('chart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        plugins: [weekendBackgroundPlugin, hourGridPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                line: {
                    borderWidth: 1.5,
                    tension: 0
                },
                point: {
                    radius: 0,
                    hitRadius: 10,
                    hoverRadius: 5
                }
            },
            parsing: true,
            normalized: true,
            plugins: {
                legend: {
                    position: 'top',
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        if (ci.isDatasetVisible(index)) {
                            ci.hide(index);
                            legendItem.hidden = true;
                        } else {
                            ci.show(index);
                            legendItem.hidden = false;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Ceny na dennom trhu s elektrinou',
                    font: {
                        size: window.innerWidth < 768 ? 14 : 16
                    }
                },
                tooltip: {
                    mode: 'stepInterval',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            const datasetIndex = context[0].datasetIndex;
                            const dataIndex = context[0].dataIndex;
                            if (datasetIndex === 0) {
                                return fullLabels[dataIndex];
                            } else if (datasetIndex === 1 && hasPrevData) {
                                return prevFullLabels[dataIndex];
                            }
                            return '';
                        },
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' €/MWh';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Dátum',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        callback: function(value, index, ticks) {
                            const label = this.getLabelForValue(value);
                            return label !== '' ? label : undefined;
                        }
                    },
                    grid: {
                        display: true,
                        drawOnChartArea: true
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cena (€/MWh)',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        }
                    }
                }
            },
            interaction: {
                mode: 'stepInterval',
                intersect: false
            }
        }
    });

    function calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const median = calculateMedian(prices);
    const minIdx = prices.indexOf(min);
    const maxIdx = prices.indexOf(max);

    document.getElementById('min').textContent = min.toFixed(2);
    document.getElementById('max').textContent = max.toFixed(2);
    document.getElementById('average').textContent = average.toFixed(2);
    document.getElementById('median').textContent = median.toFixed(2);
    document.getElementById('minWhen').textContent = `(${fullLabels[minIdx]})`;
    document.getElementById('maxWhen').textContent = `(${fullLabels[maxIdx]})`;
    showSpread('spread', 'spreadWhen', data);

    if (hasPrevData) {
        const prevPrices = prevData.map(entry => entry.price);
        const prevMin = Math.min(...prevPrices);
        const prevMax = Math.max(...prevPrices);
        const prevAverage = prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length;
        const prevMedian = calculateMedian(prevPrices);
        const prevMinIdx = prevPrices.indexOf(prevMin);
        const prevMaxIdx = prevPrices.indexOf(prevMax);

        document.getElementById('prevMin').textContent = prevMin.toFixed(2);
        document.getElementById('prevMax').textContent = prevMax.toFixed(2);
        document.getElementById('prevAverage').textContent = prevAverage.toFixed(2);
        document.getElementById('prevMedian').textContent = prevMedian.toFixed(2);
        document.getElementById('prevMinWhen').textContent = `(${prevFullLabels[prevMinIdx]})`;
        document.getElementById('prevMaxWhen').textContent = `(${prevFullLabels[prevMaxIdx]})`;
        showSpread('prevSpread', 'prevSpreadWhen', prevData);
        document.getElementById('prevRange').textContent = `${prevStartStr} – ${prevEndStr}`;
        document.getElementById('prevStats').style.display = 'grid';
    } else {
        document.getElementById('prevStats').style.display = 'none';
    }
});

// Calls update.php and returns its text output plus the number of inserted rows
// (0 when nothing new, null when the output is not the usual "Vlozených: N").
async function runUpdate() {
    const response = await fetch('update.php', { cache: 'no-store' });
    if (!response.ok) {
        return { text: `Chyba: update.php vrátil HTTP ${response.status}`, inserted: null };
    }
    const text = (await response.text()).trim();
    const match = text.match(/^Vlo[zž]en[ýy]ch:\s*(\d+)/);
    return { text, inserted: match ? parseInt(match[1]) : null };
}

document.getElementById('updateData').addEventListener('click', async () => {
    document.getElementById('updateStatus').innerText = 'Updating data...';
    const result = await runUpdate();
    document.getElementById('updateStatus').innerText = result.text;
});

// Last delivery day that should already be published: today, or tomorrow
// after 13:00 Slovak time (OKTE publishes next-day results around 13:00).
function expectedLastDay() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Bratislava',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = (type) => parseInt(parts.find(part => part.type === type).value);
    const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
    if (get('hour') >= 13) {
        day.setUTCDate(day.getUTCDate() + 1);
    }
    return day.toISOString().split('T')[0];
}

const AUTO_UPDATE_KEY = 'damAutoUpdateAttempt';
const AUTO_UPDATE_RETRY_MS = 15 * 60 * 1000;

// Fallback for the cron job: when the page opens and the expected day is
// missing in the database, fetch new data and redraw the chart.
async function autoUpdate() {
    const status = document.getElementById('updateStatus');
    try {
        const day = expectedLastDay();
        const check = await fetch(`api.php?start_date=${day}&end_date=${day}`, { cache: 'no-store' });
        const rows = await check.json();
        if (rows.error || rows.length > 0) return; // up to date (or DB problem)

        // Do not call OKTE on every page load while results are not published yet
        const lastAttempt = parseInt(localStorage.getItem(AUTO_UPDATE_KEY) || '0');
        if (Date.now() - lastAttempt < AUTO_UPDATE_RETRY_MS) return;
        localStorage.setItem(AUTO_UPDATE_KEY, String(Date.now()));

        status.innerText = 'Automaticky aktualizujem dáta...';
        const result = await runUpdate();

        if (result.inserted > 0) {
            status.innerText = `Dáta boli automaticky aktualizované (nových záznamov: ${result.inserted}).`;
            const form = document.getElementById('dataForm');
            if (form.checkValidity()) form.requestSubmit(); // redraw shown chart
        } else if (result.inserted === 0 || result.text.startsWith('Nie su')) {
            status.innerText = ''; // not published yet
        } else {
            status.innerText = `Automatická aktualizácia zlyhala. ${result.text}`;
        }
    } catch (err) {
        status.innerText = '';
    }
}

window.addEventListener('DOMContentLoaded', autoUpdate);

function shiftDateInterval(direction) {
    const startInput = document.getElementById('start_date');
    const endInput = document.getElementById('end_date');

    if (!startInput.value || !endInput.value) {
        alert('Prosím, najprv vyberte dátumy');
        return;
    }

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);

    const intervalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const shiftDays = direction === 'prev' ? -intervalDays : intervalDays;

    startDate.setDate(startDate.getDate() + shiftDays);
    endDate.setDate(endDate.getDate() + shiftDays);

    startInput.value = startDate.toISOString().split('T')[0];
    endInput.value = endDate.toISOString().split('T')[0];

    document.getElementById('dataForm').requestSubmit();
}

function shiftDateByDay(direction) {
    const startInput = document.getElementById('start_date');
    const endInput = document.getElementById('end_date');

    if (!startInput.value || !endInput.value) {
        alert('Prosím, najprv vyberte dátumy');
        return;
    }

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);

    const shiftDays = direction === 'prev' ? -1 : 1;

    startDate.setDate(startDate.getDate() + shiftDays);
    endDate.setDate(endDate.getDate() + shiftDays);

    startInput.value = startDate.toISOString().split('T')[0];
    endInput.value = endDate.toISOString().split('T')[0];

    document.getElementById('dataForm').requestSubmit();
}

document.getElementById('prevPeriod').addEventListener('click', () => {
    shiftDateInterval('prev');
});

document.getElementById('nextPeriod').addEventListener('click', () => {
    shiftDateInterval('next');
});

document.getElementById('prevDay').addEventListener('click', () => {
    shiftDateByDay('prev');
});

document.getElementById('nextDay').addEventListener('click', () => {
    shiftDateByDay('next');
});

const modal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpButton');
const closeBtn = document.querySelector('.close');

helpBtn.addEventListener('click', () => {
    modal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});
