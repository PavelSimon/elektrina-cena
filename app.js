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
                const endPoint = meta.data[weekend.endIndex];

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
        if (!cfg || !cfg.step) return;

        const ctx = chart.ctx;
        const area = chart.chartArea;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        cfg.data.forEach((entry, i) => {
            const period = parseInt(entry.period);
            if (period === 1) return; // day boundary
            // period is 15-min slot (1..96); draw line every `step` quarter-hours
            if ((period - 1) % cfg.step !== 0) return;
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

// Load dates from URL parameters on page load
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const startDate = urlParams.get('start_date');
    const endDate = urlParams.get('end_date');

    if (startDate && endDate) {
        document.getElementById('start_date').value = startDate;
        document.getElementById('end_date').value = endDate;
        document.getElementById('dataForm').requestSubmit();
    }
});

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

    const prevEndDate = new Date(startDateObj);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - intervalDays + 1);

    const prevStartStr = prevStartDate.toISOString().split('T')[0];
    const prevEndStr = prevEndDate.toISOString().split('T')[0];

    const prevResponse = await fetch(`api.php?start_date=${prevStartStr}&end_date=${prevEndStr}`);
    const prevData = await prevResponse.json();

    const hasPrevData = !prevData.error && prevData.length > 0;

    // 15-minute periods: 1..96 per day. Convert to HH:MM.
    const periodToTime = (period) => {
        const p = parseInt(period) - 1;
        const h = Math.floor(p / 4);
        const m = (p % 4) * 15;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const labels = data.map((entry) => {
        const p = parseInt(entry.period);
        if (p === 1) return `${entry.deliveryDay}`;
        // Mark 06:00/12:00/18:00 when interval <3 days (periods 25/49/73)
        if (intervalDays < 3 && (p === 25 || p === 49 || p === 73)) {
            return periodToTime(p);
        }
        return '';
    });

    // Dashed sub-day gridlines. Step is in 15-min slots:
    // <3 days → every hour (4 slots); <8 days → every 6h (24 slots); else off.
    const hourGridStep = intervalDays < 3 ? 4 : (intervalDays < 8 ? 24 : 0);

    const prices = data.map(entry => entry.price);

    const fullLabels = data.map(entry => `${entry.deliveryDay} ${periodToTime(entry.period)}`);

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
        data: prices,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(75, 192, 192)',
        borderWidth: 1.5,
        spanGaps: false,
        _weekendData: weekendData,
        _hourGrid: { step: hourGridStep, data: data }
    }];

    let prevFullLabels = [];
    if (hasPrevData) {
        const prevPrices = prevData.map(entry => entry.price);
        prevFullLabels = prevData.map(entry => `${entry.deliveryDay} ${periodToTime(entry.period)}`);

        datasets.push({
            label: `Predchádzajúce obdobie (${prevStartStr} - ${prevEndStr})`,
            data: prevPrices,
            fill: false,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.1,
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
                    tension: 0.1
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
                    mode: 'index',
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
                mode: 'nearest',
                axis: 'x',
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
        document.getElementById('prevStats').style.display = 'grid';
    } else {
        document.getElementById('prevStats').style.display = 'none';
    }
});

document.getElementById('updateData').addEventListener('click', async () => {
    document.getElementById('updateStatus').innerText = 'Updating data...';
    const response = await fetch('update.php');
    const result = await response.text();
    document.getElementById('updateStatus').innerText = result;
});

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
