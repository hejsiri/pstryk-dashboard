(function () {
    const data = window.__PSTRYK_DASHBOARD__ || {};

    const todayFrames = data.todayFrames || [];
    const tomorrowFrames = data.tomorrowFrames || [];
    const todaySellFrames = data.todaySellFrames || [];
    const tomorrowSellFrames = data.tomorrowSellFrames || [];
    let currentPriceMode = 'buy';
    let secondsToPublish = Number(data.secondsToPublish || 0);
    const bgModeUrls = data.bgModeUrls || {};
    const themeColorByMode = data.themeColorByMode || {};
    let currentBgMode = data.bgMode || 'auto';
    let currentBgUrl = null;
    let bgTransitionTimer = null;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    function hourLabel(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }

    function hourAxisLabel(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit' });
    }

    function rangeLabel(startIso, endIso) {
        const start = hourLabel(startIso);
        const end = hourLabel(endIso);
        if (!start && !end) return '';
        return `${start} - ${end}`;
    }

    function warsawHour(date = new Date()) {
        const formatted = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'Europe/Warsaw'
        }).format(date);
        return Number(formatted);
    }

    function autoBgModeForNow(date = new Date()) {
        const hour = warsawHour(date);
        if (hour >= 9 && hour < 18) return 'day';
        if (hour >= 21 || hour < 5) return 'night';
        if (hour >= 5 && hour < 9) return 'morning';
        return 'evening';
    }

    function applyBackgroundMode(mode) {
        const effectiveMode = mode === 'auto' ? autoBgModeForNow() : mode;
        const bgUrl = bgModeUrls[effectiveMode];
        const themeColor = themeColorByMode[effectiveMode];
        if (typeof bgUrl === 'string' && bgUrl !== '') {
            if (currentBgUrl === null) {
                currentBgUrl = bgUrl;
                document.body.style.setProperty('--dashboard-bg', `url('${bgUrl}')`);
            } else if (currentBgUrl !== bgUrl) {
                if (bgTransitionTimer) {
                    window.clearTimeout(bgTransitionTimer);
                }
                document.body.style.setProperty('--dashboard-bg-next', `url('${bgUrl}')`);
                document.body.classList.add('bg-transition');
                bgTransitionTimer = window.setTimeout(() => {
                    document.body.classList.add('bg-no-transition');
                    document.body.style.setProperty('--dashboard-bg', `url('${bgUrl}')`);
                    document.body.style.removeProperty('--dashboard-bg-next');
                    document.body.classList.remove('bg-transition');
                    currentBgUrl = bgUrl;
                    bgTransitionTimer = null;
                    void document.body.offsetHeight;
                    document.body.classList.remove('bg-no-transition');
                }, 920);
            }
        }
        if (themeColorMeta && typeof themeColor === 'string' && themeColor !== '') {
            themeColorMeta.setAttribute('content', themeColor);
        }
        document.body.classList.toggle('bg-night', effectiveMode === 'night');
    }

    function startAutoBackgroundScheduler() {
        window.setInterval(() => {
            if (currentBgMode === 'auto') {
                applyBackgroundMode('auto');
            }
        }, 30000);
    }

    function initBgSwitcher() {
        const form = document.querySelector('.bg-switcher-form');
        if (!form) return;

        const buttons = Array.from(form.querySelectorAll('.bg-switch-btn'));
        if (!buttons.length) return;

        function setActive(mode) {
            buttons.forEach((btn) => {
                const isActive = (btn.dataset.mode || btn.value) === mode;
                btn.classList.toggle('active', isActive);
            });
        }

        async function persistMode(mode) {
            const formData = new FormData();
            formData.set('action', 'set_bg_mode');
            formData.set('bg_mode', mode);
            formData.set('ajax', '1');
            try {
                await fetch(window.location.pathname + window.location.search, {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
            } catch (_) {
                // Ignored on purpose; UI already updated optimistically.
            }
        }

        buttons.forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const mode = btn.dataset.mode || btn.value;
                currentBgMode = mode;
                applyBackgroundMode(mode);
                setActive(mode);
                persistMode(mode);
            });
        });

        applyBackgroundMode(currentBgMode);
    }

    function initSettingsMenu() {
        const menu = document.querySelector('.settings-menu');
        if (!menu) return;

        const closeBtn = menu.querySelector('[data-close-settings="1"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                menu.removeAttribute('open');
            });
        }

        document.addEventListener('click', (event) => {
            if (!menu.hasAttribute('open')) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('.settings-panel') || target.closest('.settings-toggle')) return;
            menu.removeAttribute('open');
        });
    }

    initBgSwitcher();
    initPriceModeSwitcher();
    initSettingsMenu();
    startAutoBackgroundScheduler();

    const views = [
        {
            key: 'today',
            label: 'Dzisiaj',
            frames: todayFrames,
            barColor: '#0f766e',
            liveBarColor: '#f59e0b',
            sellBarColor: '#16a34a',
            sellLiveBarColor: '#4ade80',
            info: 'Dzisiejsze ceny godzinowe brutto energii.'
        }
    ];

    if (tomorrowFrames.length > 0) {
        views.push({
            key: 'tomorrow',
            label: 'Jutro',
            frames: tomorrowFrames,
            barColor: '#1e3a5f',
            liveBarColor: '#f59e0b',
            minBarColor: '#15803d',
            sellBarColor: '#166534',
            sellLiveBarColor: '#4ade80',
            info: 'Jutrzejsze ceny godzinowe brutto energii.'
        });
    }

    const chartEl = document.getElementById('priceChart');
    const chartTitleEl = document.getElementById('chartTitle');
    const chartInfoEl = document.getElementById('chartInfo');
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    const countdownEl = document.getElementById('nextDayCountdown');

    if (!chartEl || !chartTitleEl || !chartInfoEl || !prevBtn || !nextBtn || !countdownEl || typeof Chart === 'undefined') {
        return;
    }

    let currentViewIndex = 0;

    function isDesktopChart() {
        return window.matchMedia('(min-width: 701px)').matches;
    }

    function applyXAxisDensity() {
        if (!priceChart || !priceChart.options || !priceChart.options.scales || !priceChart.options.scales.x) {
            return;
        }

        const xTicks = priceChart.options.scales.x.ticks || {};
        if (isDesktopChart()) {
            xTicks.autoSkip = false;
            delete xTicks.maxTicksLimit;
        } else {
            xTicks.autoSkip = true;
            xTicks.maxTicksLimit = 12;
        }
        priceChart.options.scales.x.ticks = xTicks;
    }

    function formatCountdown(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    function updateNavVisibility() {
        const onToday = currentViewIndex === 0;
        const hasTomorrow = views.length > 1;
        const beforePublish = secondsToPublish > 0;
        prevBtn.textContent = '← dziś';
        nextBtn.textContent = 'jutro →';

        prevBtn.style.display = onToday ? 'none' : 'inline-block';

        if (onToday && beforePublish) {
            nextBtn.style.display = 'none';
            countdownEl.style.display = 'inline-block';
            countdownEl.textContent = `Ceny na jutro dostępne za ${formatCountdown(secondsToPublish)}`;
            return;
        }

        countdownEl.style.display = 'none';

        if (onToday && hasTomorrow) {
            nextBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'none';
        }

        if (!onToday) {
            nextBtn.style.display = 'none';
            prevBtn.style.display = 'inline-block';
        }
    }

    function drawRoundedRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    const livePriceBadgePlugin = {
        id: 'livePriceBadge',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const chartLeft = (chart.chartArea?.left ?? 0) + 4;
            const chartRight = (chart.chartArea?.right ?? chart.width) - 4;

            const ds0 = chart.data.datasets[0];
            const ds1 = chart.data.datasets[1];
            const meta0 = chart.getDatasetMeta(0);
            const meta1 = chart.getDatasetMeta(1);
            const vis0 = ds0 && meta0 && !meta0.hidden;
            const vis1 = ds1 && meta1 && !meta1.hidden;

            // Both datasets visible — draw one combined live badge
            if (vis0 && vis1) {
                const liveIdx0 = ds0.liveIndex;
                const liveIdx1 = ds1.liveIndex;
                const el0 = (typeof liveIdx0 === 'number' && liveIdx0 >= 0) ? meta0.data[liveIdx0] : null;
                const el1 = (typeof liveIdx1 === 'number' && liveIdx1 >= 0) ? meta1.data[liveIdx1] : null;

                if (el0 || el1) {
                    const refEl = el0 || el1;
                    const bottom0 = el0 ? Math.max(el0.y, el0.base) : null;
                    const bottom1 = el1 ? Math.max(el1.y, el1.base) : null;
                    const maxBottom = Math.max(bottom0 ?? 0, bottom1 ?? 0);
                    const x = refEl.x;
                    const y = maxBottom + 16;

                    const buyVal = el0 ? Number(ds0.data[liveIdx0] || 0) : null;
                    const sellVal = el1 ? Number(ds1.data[liveIdx1] || 0) : null;
                    const text = [
                        buyVal !== null ? `z: ${buyVal.toFixed(2)} zł` : null,
                        sellVal !== null ? `s: ${sellVal.toFixed(2)} zł` : null
                    ].filter(Boolean).join('  ');

                    ctx.save();
                    ctx.font = '700 12px "IBM Plex Sans", sans-serif';
                    const textW = ctx.measureText(text).width;
                    const padX = 10;
                    const boxW = textW + padX * 2;
                    const boxH = 24;
                    const boxX = Math.min(Math.max(x - boxW / 2, chartLeft), chartRight - boxW);
                    const boxY = y - boxH / 2;

                    const barColors = ds0.backgroundColor;
                    const badgeColor = Array.isArray(barColors) ? (barColors[liveIdx0] ?? barColors[0]) : barColors;
                    ctx.fillStyle = badgeColor || '#0f766e';
                    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, boxX + padX, y + 0.5);
                    ctx.restore();
                }

                // Min badge — only from buy dataset (0)
                const minIdx0 = ds0.minIndex;
                if (typeof minIdx0 === 'number' && minIdx0 >= 0) {
                    const minEl = meta0.data[minIdx0];
                    if (minEl) {
                        const minValue = Number(ds0.data[minIdx0] || 0);
                        const minText = `min ${minValue.toFixed(2)} zł`;
                        const x = minEl.x;
                        const top = Math.min(minEl.y, minEl.base);
                        const y = top - 18;

                        ctx.save();
                        ctx.font = '700 11px "IBM Plex Sans", sans-serif';
                        const textW = ctx.measureText(minText).width;
                        const padX = 8;
                        const boxW = textW + padX * 2;
                        const boxH = 22;
                        const boxX = x - boxW / 2;
                        const boxY = y - boxH / 2;

                        ctx.fillStyle = '#15803d';
                        drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 9);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(minText, x, y + 0.5);
                        ctx.restore();
                    }
                }
                return;
            }

            // Single dataset visible — original behavior
            [[ds0, meta0, vis0], [ds1, meta1, vis1]].forEach(([dataset, meta, vis]) => {
                if (!vis) return;

                const liveIndex = dataset.liveIndex;
                const minIndex = dataset.minIndex;

                if (typeof liveIndex === 'number' && liveIndex >= 0) {
                    const element = meta.data[liveIndex];
                    if (element) {
                        const value = Number(dataset.data[liveIndex] || 0);
                        const text = `${value.toFixed(2)} zł`;
                        const x = element.x;
                        const top = Math.min(element.y, element.base);
                        const bottom = Math.max(element.y, element.base);
                        const isNegative = value < 0;
                        const y = isNegative ? (top - 16) : (bottom + 16);

                        ctx.save();
                        ctx.font = '700 12px "IBM Plex Sans", sans-serif';
                        const textW = ctx.measureText(text).width;
                        const padX = 10;
                        const boxW = textW + padX * 2;
                        const boxH = 24;
                        const boxX = Math.min(Math.max(x - boxW / 2, chartLeft), chartRight - boxW);
                        const boxY = y - boxH / 2;

                        const barColors = dataset.backgroundColor;
                        const badgeColor = Array.isArray(barColors) ? (barColors[liveIndex] || barColors[0]) : barColors;
                        ctx.fillStyle = badgeColor || (isNegative ? '#b45309' : '#0f766e');
                        drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, boxX + padX, y + 0.5);
                        ctx.restore();
                    }
                }

                if (typeof minIndex === 'number' && minIndex >= 0) {
                    const minElement = meta.data[minIndex];
                    if (minElement) {
                        const minValue = Number(dataset.data[minIndex] || 0);
                        const minText = `min ${minValue.toFixed(2)} zł`;
                        const x = minElement.x;
                        const top = Math.min(minElement.y, minElement.base);
                        const y = top - 18;

                        ctx.save();
                        ctx.font = '700 11px "IBM Plex Sans", sans-serif';
                        const textW = ctx.measureText(minText).width;
                        const padX = 8;
                        const boxW = textW + padX * 2;
                        const boxH = 22;
                        const boxX = x - boxW / 2;
                        const boxY = y - boxH / 2;

                        ctx.fillStyle = '#15803d';
                        drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 9);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(minText, x, y + 0.5);
                        ctx.restore();
                    }
                }
            });
        }
    };

    const glassBarsPlugin = {
        id: 'glassBars',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;

            chart.data.datasets.forEach((_, dsIdx) => {
                const meta = chart.getDatasetMeta(dsIdx);
                if (!meta || !meta.data || !meta.data.length || meta.hidden) return;

                meta.data.forEach((bar) => {
                    const props = bar.getProps(['x', 'y', 'base', 'width'], true);
                    const top = Math.min(props.y, props.base);
                    const bottom = Math.max(props.y, props.base);
                    const height = bottom - top;
                    if (!Number.isFinite(height) || height < 3) return;

                    const width = Math.max(2, (props.width || 0));
                    const left = props.x - (width / 2);
                    const radius = Math.min(8, width / 2, height / 2);

                    ctx.save();

                    // Subtle white sheen in the upper half of each bar.
                    const sheen = ctx.createLinearGradient(0, top, 0, top + (height * 0.55));
                    sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
                    sheen.addColorStop(0.45, 'rgba(255,255,255,0.1)');
                    sheen.addColorStop(1, 'rgba(255,255,255,0)');
                    drawRoundedRect(ctx, left, top, width, height, radius);
                    ctx.fillStyle = sheen;
                    ctx.fill();

                    // Thin outer edge for glass depth.
                    drawRoundedRect(ctx, left + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1), Math.max(1, radius - 0.5));
                    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.restore();
                });
            });
        }
    };

    const priceChart = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'zakup',
                    data: [],
                    borderColor: '#0f766e',
                    backgroundColor: '#0f766e',
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 26
                },
                {
                    label: 'sprzedaż',
                    data: [],
                    borderColor: '#0f766e',
                    backgroundColor: '#0f766e',
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 26,
                    hidden: true
                }
            ]
        },
        plugins: [glassBarsPlugin, livePriceBadgePlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 360,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: (items) => {
                            if (!items || items.length === 0) return '';
                            const item = items[0];
                            const frameRanges = item.dataset.frameRanges || [];
                            return frameRanges[item.dataIndex] || '';
                        },
                        label: (ctx) => {
                            const prefix = currentPriceMode === 'both' ? `${ctx.dataset.label}: ` : '';
                            return `${prefix}${ctx.parsed.y.toFixed(2)} zł`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    grid: {
                        color: 'rgba(95, 90, 83, 0.14)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: (v) => `${Number(v).toFixed(2)} zł`
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                }
            }
        }
    });

    function initPriceModeSwitcher() {
        const btns = document.querySelectorAll('.price-mode-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentPriceMode = btn.dataset.priceMode;
                btns.forEach(b => b.classList.toggle('active', b === btn));
                renderView(currentViewIndex);
            });
        });
    }

    function renderView(index) {
        const view = views[index];
        const buyFrames = index === 0 ? todayFrames : tomorrowFrames;
        const sellFrames = index === 0 ? todaySellFrames : tomorrowSellFrames;
        const showBuy = currentPriceMode !== 'sell';
        const showSell = currentPriceMode !== 'buy';
        const dayWord = view.label.toLowerCase();

        chartTitleEl.textContent = `Ceny energii ${dayWord}`;
        chartInfoEl.textContent = view.info;
        updateNavVisibility();
        applyXAxisDensity();

        const activeFrames = showBuy ? buyFrames : sellFrames;
        if (!activeFrames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = [view.barColor];
            priceChart.data.datasets[0].backgroundColor = [view.barColor];
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.data.datasets[1].data = [];
            priceChart.options.plugins.tooltip.enabled = false;
            priceChart.setDatasetVisibility(0, true);
            priceChart.setDatasetVisibility(1, false);
            priceChart.update();
            return;
        }

        const labelFrames = buyFrames.length ? buyFrames : sellFrames;
        priceChart.data.labels = labelFrames.map(f => hourAxisLabel(f.start));

        // --- buy dataset (0) ---
        const buyValues = buyFrames.map(f => f.display_price);
        const buyLiveIndex = buyFrames.findIndex(f => f.is_live);
        let minIndex = -1;
        if (view.key === 'tomorrow') {
            let minValue = Number.POSITIVE_INFINITY;
            buyValues.forEach((v, i) => {
                const n = Number(v);
                if (Number.isFinite(n) && n < minValue) { minValue = n; minIndex = i; }
            });
        }
        const buyBarColor = view.barColor;
        const buyLiveColor = view.liveBarColor;
        priceChart.data.datasets[0].data = buyValues;
        priceChart.data.datasets[0].borderColor = buyFrames.map((_, i) => {
            if (i === buyLiveIndex) return buyLiveColor;
            if (i === minIndex) return view.minBarColor || '#15803d';
            return buyBarColor;
        });
        priceChart.data.datasets[0].backgroundColor = priceChart.data.datasets[0].borderColor;
        priceChart.data.datasets[0].liveIndex = buyLiveIndex;
        priceChart.data.datasets[0].minIndex = minIndex;
        priceChart.data.datasets[0].frameRanges = buyFrames.map(f => rangeLabel(f.start, f.end));

        // --- sell dataset (1) ---
        const sellValues = sellFrames.map(f => f.display_price);
        const sellLiveIndex = sellFrames.findIndex(f => f.is_live);
        priceChart.data.datasets[1].data = sellValues;
        priceChart.data.datasets[1].borderColor = sellFrames.map((_, i) =>
            i === sellLiveIndex ? view.sellLiveBarColor : view.sellBarColor
        );
        priceChart.data.datasets[1].backgroundColor = priceChart.data.datasets[1].borderColor;
        priceChart.data.datasets[1].liveIndex = sellLiveIndex;
        priceChart.data.datasets[1].minIndex = -1;
        priceChart.data.datasets[1].frameRanges = sellFrames.map(f => rangeLabel(f.start, f.end));

        priceChart.setDatasetVisibility(0, showBuy);
        priceChart.setDatasetVisibility(1, showSell);
        priceChart.options.plugins.tooltip.enabled = true;
        priceChart.update();
    }

    prevBtn.addEventListener('click', () => {
        if (currentViewIndex > 0) {
            currentViewIndex -= 1;
            renderView(currentViewIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentViewIndex < views.length - 1) {
            currentViewIndex += 1;
            renderView(currentViewIndex);
        }
    });

    setInterval(() => {
        if (secondsToPublish > 0) {
            secondsToPublish -= 1;
            updateNavVisibility();
        }
    }, 1000);

    window.addEventListener('resize', () => {
        applyXAxisDensity();
        priceChart.update('none');
    });

    renderView(currentViewIndex);
})();
