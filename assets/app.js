(function () {
    const data = window.__PSTRYK_DASHBOARD__ || {};

    let todayFrames = data.todayFrames || [];
    let tomorrowFrames = data.tomorrowFrames || [];
    let todaySellFrames = data.todaySellFrames || [];
    let tomorrowSellFrames = data.tomorrowSellFrames || [];
    let todayUsageFrames = data.todayUsageFrames || [];
    let todayCostFrames = data.todayCostFrames || [];
    let monthUsageDailyFrames = data.monthUsageDailyFrames || [];
    let monthCostDailyFrames = data.monthCostDailyFrames || [];
    let previousMonthUsageDailyFrames = data.previousMonthUsageDailyFrames || [];
    let previousMonthCostDailyFrames = data.previousMonthCostDailyFrames || [];
    let secondsToPublish = Number(data.secondsToPublish || 0);
    const dashboardDataUrl = data.dashboardDataUrl || '';
    const bgModeUrls = data.bgModeUrls || {};
    const themeColorByMode = data.themeColorByMode || {};
    let currentBgMode = data.bgMode || 'auto';
    let currentBgUrl = null;
    let bgTransitionTimer = null;
    const chartModeStorageKey = 'pstrykDashboardChartMode';
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    function normalizeApiIso(iso) {
        if (typeof iso !== 'string') return '';
        return iso.includes(' ') ? iso.replace(' ', 'T') : iso;
    }

    function parseApiDate(iso) {
        if (!iso) return null;
        const normalized = normalizeApiIso(iso);
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function warsawDateParts(date) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return {
            year: Number(map.year),
            month: Number(map.month),
            day: Number(map.day)
        };
    }

    function hourLabel(iso) {
        if (!iso) return '';
        const d = parseApiDate(iso);
        if (!d) return iso;
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }

    function hourAxisLabel(iso) {
        if (!iso) return '';
        const d = parseApiDate(iso);
        if (!d) return iso;
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit' });
    }

    function dayAxisLabel(iso) {
        if (!iso) return '';
        const d = parseApiDate(iso);
        if (!d) return iso;
        return d.toLocaleDateString('pl-PL', { day: '2-digit', timeZone: 'Europe/Warsaw' });
    }

    function monthHeadingLabel(frames, period = 'current') {
        const list = Array.isArray(frames) ? frames : [];
        const firstFrame = list.find((frame) => frame && frame.start);
        let date = firstFrame ? parseApiDate(firstFrame.start) : null;

        if (!date) {
            date = new Date();
            if (period === 'previous') {
                date = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            }
        }

        return date.toLocaleDateString('pl-PL', {
            month: 'long',
            year: 'numeric',
            timeZone: 'Europe/Warsaw'
        });
    }

    function monthFrameTemplate(referenceDate = new Date()) {
        const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
        return {
            year: now.getFullYear(),
            monthIndex: now.getMonth(),
            totalDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        };
    }

    function monthReferenceDate(period = 'current') {
        const date = new Date();
        if (period === 'previous') {
            return new Date(date.getFullYear(), date.getMonth() - 1, 1);
        }
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function fillMonthFrames(frames, valueKey, period = 'current') {
        const list = Array.isArray(frames) ? frames : [];
        const template = monthFrameTemplate(monthReferenceDate(period));
        const byDay = new Map();

        list.forEach((frame) => {
            const date = parseApiDate(frame.start || '');
            if (!date) return;
            const parts = warsawDateParts(date);
            byDay.set(parts.day, frame);
            if (frame.start) {
                template.year = parts.year;
                template.monthIndex = parts.month - 1;
                template.totalDays = new Date(template.year, template.monthIndex + 1, 0).getDate();
            }
        });

        return Array.from({ length: template.totalDays }, (_, offset) => {
            const day = offset + 1;
            if (byDay.has(day)) {
                return byDay.get(day);
            }

            const start = new Date(template.year, template.monthIndex, day, 0, 0, 0, 0);
            const end = new Date(template.year, template.monthIndex, day + 1, 0, 0, 0, 0);
            return {
                start: start.toISOString(),
                end: end.toISOString(),
                [valueKey]: 0,
                is_live: false,
                is_projected: true
            };
        });
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
    initSettingsMenu();
    startAutoBackgroundScheduler();

    function createViews() {
        const nextViews = [
            {
                key: 'today',
                label: 'Dzisiaj',
                frames: todayFrames,
                sellFrames: todaySellFrames,
                barColor: '#0f766e',
                negativeBarColor: '#84cc16',
                sellColor: '#14532d',
                liveBarColor: '#f59e0b',
                info: 'Dzisiejsze ceny godzinowe brutto energii: zakup jako słupki, sprzedaż jako linia.'
            }
        ];

        if (tomorrowFrames.length > 0) {
            nextViews.push({
                key: 'tomorrow',
                label: 'Jutro',
                frames: tomorrowFrames,
                sellFrames: tomorrowSellFrames,
                barColor: '#1e3a5f',
                negativeBarColor: '#84cc16',
                sellColor: '#14532d',
                liveBarColor: '#f59e0b',
                minBarColor: '#15803d',
                info: 'Jutrzejsze ceny godzinowe brutto energii: zakup jako słupki, sprzedaż jako linia.'
            });
        }

        return nextViews;
    }

    let views = createViews();

    const chartEl = document.getElementById('priceChart');
    const chartTitleEl = document.getElementById('chartTitle');
    const chartSummaryBadgeEl = document.getElementById('chartSummaryBadge');
    const chartInfoEl = document.getElementById('chartInfo');
    const chartLoaderEl = document.getElementById('chartLoader');
    const chartModeButtons = Array.from(document.querySelectorAll('[data-chart-mode]'));
    const todayUsageMetric = document.querySelector('[data-chart-view="today-usage"]');
    const todayCostMetric = document.querySelector('[data-chart-view="today-cost"]');
    const monthUsageMetric = document.querySelector('[data-chart-view="month-usage"]');
    const monthCostMetric = document.querySelector('[data-chart-view="month-cost"]');
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    const countdownEl = document.getElementById('nextDayCountdown');

    if (!chartEl || !chartTitleEl || !chartSummaryBadgeEl || !chartInfoEl || !prevBtn || !nextBtn || !countdownEl || typeof Chart === 'undefined') {
        return;
    }

    let currentViewIndex = 0;
    let chartMode = readStoredChartMode();
    let chartView = 'prices';
    let monthUsagePeriod = 'current';
    let monthCostPeriod = 'current';

    function readStoredChartMode() {
        try {
            const mode = window.localStorage.getItem(chartModeStorageKey);
            return ['buy', 'sell', 'both'].includes(mode) ? mode : 'buy';
        } catch (_) {
            return 'buy';
        }
    }

    function storeChartMode(mode) {
        try {
            window.localStorage.setItem(chartModeStorageKey, mode);
        } catch (_) {
            // Ignore storage failures; the switch still works for this session.
        }
    }

    function setDashboardLoading(isLoading) {
        document.body.classList.toggle('dashboard-loading', isLoading);
        document.body.classList.toggle('dashboard-loaded', !isLoading);
        if (chartLoaderEl) {
            chartLoaderEl.hidden = !isLoading;
        }
    }

    function formatMetric(value, suffix) {
        const num = Number(value);
        if (!Number.isFinite(num)) return `0,00 ${suffix}`;
        return `${num.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} ${suffix}`;
    }

    function setMetric(name, value, suffix) {
        const el = document.querySelector(`[data-metric-value="${name}"]`);
        if (!el) return;
        el.textContent = formatMetric(value, suffix);
        el.classList.remove('is-loading');
    }

    function updateMetrics(metrics) {
        const values = metrics || {};
        setMetric('todayUsage', values.todayUsage, 'kWh');
        setMetric('monthUsage', values.monthUsage, 'kWh');
        setMetric('todayCost', values.todayCost, 'zł');
        setMetric('monthCost', values.monthCost, 'zł');
    }

    function updateMeterSelect(meters, selectedMeterId) {
        const select = document.getElementById('meter_id');
        if (!select || !Array.isArray(meters)) return;

        select.replaceChildren();
        meters.forEach((meter) => {
            const id = Number(meter.id || 0);
            const option = document.createElement('option');
            option.value = String(id);
            option.textContent = `${meter.name || 'Licznik'} (#${id})`;
            option.selected = Number(selectedMeterId || 0) === id;
            select.append(option);
        });

        if (!meters.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Brak liczników';
            select.append(option);
        }
    }

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

    function setMetricChartView(view) {
        const states = [
            [todayUsageMetric, view === 'usage'],
            [todayCostMetric, view === 'cost'],
            [monthUsageMetric, view === 'month-usage'],
            [monthCostMetric, view === 'month-cost']
        ];

        states.forEach(([metric, isActive]) => {
            if (!metric) return;
            metric.classList.toggle('is-active', isActive);
            metric.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function setYAxisUnit(unit) {
        priceChart.options.scales.y.ticks.callback = (v) => `${Number(v).toFixed(2)} ${unit}`;
    }

    function setChartSummaryBadge(value, suffix) {
        if (value === null || value === undefined) {
            chartSummaryBadgeEl.hidden = true;
            chartSummaryBadgeEl.textContent = '';
            return;
        }
        chartSummaryBadgeEl.textContent = formatMetric(value, suffix);
        chartSummaryBadgeEl.hidden = false;
    }

    function showMonthToggle(period, label) {
        prevBtn.style.display = 'none';
        countdownEl.style.display = 'none';
        nextBtn.style.display = 'inline-block';
        if (period === 'previous') {
            nextBtn.textContent = 'bieżący miesiąc →';
            nextBtn.setAttribute('aria-label', `Pokaż bieżący miesiąc dla ${label}`);
        } else {
            nextBtn.textContent = '← poprzedni miesiąc';
            nextBtn.setAttribute('aria-label', `Pokaż poprzedni miesiąc dla ${label}`);
        }
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
        if (chartView !== 'prices') {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            countdownEl.style.display = 'none';
            return;
        }

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

    function drawBottomRoundedRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.closePath();
    }

    function applyYAxisBounds(values) {
        const nums = values
            .map(Number)
            .filter(Number.isFinite);
        const yScale = priceChart.options.scales.y;

        if (!nums.length) {
            yScale.min = 0;
            yScale.suggestedMax = undefined;
            return;
        }

        const rawMin = Math.min(...nums, 0);
        const rawMax = Math.max(...nums, 0);
        const span = rawMax - rawMin || Math.max(Math.abs(rawMax), 1);
        const padding = span * 0.12;

        yScale.min = rawMin < 0 ? rawMin - padding : 0;
        yScale.suggestedMax = rawMax + padding;
    }

    function allChartValues() {
        const values = [];
        priceChart.data.datasets.forEach((dataset) => {
            values.push(...(dataset.data || []));
        });
        return values;
    }

    function sellAreaGradient(chart) {
        const chartArea = chart.chartArea;
        if (!chartArea) return 'rgba(20, 83, 45, 0.1)';

        const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(20, 83, 45, 0.24)');
        gradient.addColorStop(0.55, 'rgba(20, 83, 45, 0.1)');
        gradient.addColorStop(1, 'rgba(20, 83, 45, 0)');
        return gradient;
    }

    const livePriceBadgePlugin = {
        id: 'livePriceBadge',
        afterDatasetsDraw(chart) {
            const dataset = chart.data.datasets[0];
            if (!dataset) return;
            const selectedIndex = dataset.selectedIndex;
            const minIndex = dataset.minIndex;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;

            const ctx = chart.ctx;
            let selectedBadgeBox = null;

            if (typeof selectedIndex === 'number' && selectedIndex >= 0) {
                const element = meta.data[selectedIndex];
                if (element) {
                    const value = Number(dataset.data[selectedIndex] || 0);
                    const sellDataset = chart.data.datasets[1];
                    const sellValue = Number(sellDataset?.data?.[selectedIndex]);
                    const showBuyValue = chart.isDatasetVisible(0) && Number.isFinite(value);
                    const showSellValue = chart.isDatasetVisible(1) && Number.isFinite(sellValue);
                    if (!showBuyValue && !showSellValue) return;
                    const buyLabel = dataset.badgeLabel || 'zakup';
                    const buyUnit = dataset.badgeUnit || 'zł';
                    const buyBadgeColor = dataset.badgeColor || '#b91c1c';
                    const sellLabel = sellDataset?.badgeLabel || sellDataset?.label || 'sprzedaż';
                    const sellUnit = sellDataset?.badgeUnit || 'zł';
                    const sellBadgeColor = sellDataset?.badgeColor || '#14532d';
                    const lines = showBuyValue && showSellValue
                        ? [`${buyLabel} ${value.toFixed(2)} ${buyUnit}`, `${sellLabel} ${sellValue.toFixed(2)} ${sellUnit}`]
                        : (showSellValue ? [`${sellLabel} ${sellValue.toFixed(2)} ${sellUnit}`] : [`${buyLabel} ${value.toFixed(2)} ${buyUnit}`]);
                    const activeValue = showBuyValue ? value : sellValue;
                    const activeMeta = chart.getDatasetMeta(showBuyValue ? 0 : 1);
                    const activeElement = activeMeta?.data?.[selectedIndex] || element;
                    const zeroY = chart.scales.y.getPixelForValue(0);
                    const valueY = chart.scales.y.getPixelForValue(activeValue);
                    const x = activeElement.x;
                    const top = showBuyValue ? Math.min(valueY, zeroY) : valueY;
                    const bottom = showBuyValue ? Math.max(valueY, zeroY) : valueY;
                    const isNegative = activeValue < 0;
                    const placeBadgeAbove = isNegative || dataset.forceBadgeAbove === true;
                    const pointerH = 7;
                    const boxGap = 8;

                    ctx.save();
                    ctx.font = '800 15px "IBM Plex Sans", sans-serif';
                    const textW = Math.max(...lines.map((line) => ctx.measureText(line).width));
                    const padX = 12;
                    const lineH = 18;
                    const boxW = textW + padX * 2;
                    const boxH = showSellValue ? 42 : 30;
                    let y = placeBadgeAbove
                        ? (top - boxGap - pointerH - boxH / 2)
                        : (bottom + boxGap + pointerH + boxH / 2);
                    const chartLeft = (chart.chartArea?.left ?? 0) + 4;
                    const chartRight = (chart.chartArea?.right ?? chart.width) - 4;
                    const centeredBoxX = x - (boxW / 2);
                    const boxX = Math.min(Math.max(centeredBoxX, chartLeft), chartRight - boxW);
                    const minBoxY = (placeBadgeAbove ? 4 : pointerH + 4);
                    const maxBoxY = chart.height - boxH - (placeBadgeAbove ? pointerH : 0) - 4;
                    let boxY = y - (boxH / 2);
                    boxY = Math.min(Math.max(boxY, minBoxY), maxBoxY);
                    y = boxY + boxH / 2;
                    selectedBadgeBox = { x: boxX, y: boxY, w: boxW, h: boxH };
                    const pointerX = Math.min(Math.max(x, boxX + 14), boxX + boxW - 14);
                    const pointerW = 12;

                    ctx.fillStyle = buyBadgeColor;
                    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 11);
                    ctx.fill();
                    if (showSellValue && !showBuyValue) {
                        ctx.fillStyle = sellBadgeColor;
                        drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 11);
                        ctx.fill();
                    } else if (showSellValue) {
                        ctx.fillStyle = sellBadgeColor;
                        drawBottomRoundedRect(ctx, boxX, boxY + boxH / 2, boxW, boxH / 2, 11);
                        ctx.fill();
                    }
                    ctx.fillStyle = isNegative ? '#14532d' : (showSellValue && !showBuyValue ? sellBadgeColor : buyBadgeColor);
                    ctx.beginPath();
                    if (placeBadgeAbove) {
                        ctx.moveTo(pointerX - pointerW / 2, boxY + boxH);
                        ctx.lineTo(pointerX + pointerW / 2, boxY + boxH);
                        ctx.lineTo(pointerX, boxY + boxH + pointerH);
                    } else {
                        ctx.moveTo(pointerX - pointerW / 2, boxY);
                        ctx.lineTo(pointerX + pointerW / 2, boxY);
                        ctx.lineTo(pointerX, boxY - pointerH);
                    }
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = showSellValue ? 'right' : 'left';
                    ctx.textBaseline = 'alphabetic';
                    const textStartY = y - ((lines.length - 1) * lineH / 2) + 5;
                    lines.forEach((line, lineIndex) => {
                        const textX = showSellValue ? boxX + boxW - padX : boxX + padX;
                        ctx.fillText(line, textX, textStartY + lineIndex * lineH);
                    });
                    ctx.restore();
                }
            }

            if (typeof minIndex === 'number' && minIndex >= 0 && minIndex !== selectedIndex) {
                const minElement = meta.data[minIndex];
                if (minElement) {
                    const minValue = Number(dataset.data[minIndex] || 0);
                    const minText = `min ${minValue.toFixed(2)} zł`;
                    const x = minElement.x;
                    const top = Math.min(minElement.y, minElement.base);
                    const bottom = Math.max(minElement.y, minElement.base);
                    const isNegative = minValue < 0;
                    const pointerH = 7;
                    const boxGap = 8;

                    ctx.save();
                    ctx.font = '800 15px "IBM Plex Sans", sans-serif';
                    const textW = ctx.measureText(minText).width;
                    const padX = 12;
                    const boxW = textW + padX * 2;
                    const boxH = 30;
                    const chartLeft = (chart.chartArea?.left ?? 0) + 4;
                    const chartRight = (chart.chartArea?.right ?? chart.width) - 4;
                    const centeredBoxX = x - (boxW / 2);
                    const boxX = Math.min(Math.max(centeredBoxX, chartLeft), chartRight - boxW);
                    let y = isNegative
                        ? (top - boxGap - pointerH - boxH / 2)
                        : (bottom + boxGap + pointerH + boxH / 2);
                    const minBoxY = (isNegative ? 4 : pointerH + 4);
                    const maxBoxY = chart.height - boxH - (isNegative ? pointerH : 0) - 4;
                    let boxY = y - (boxH / 2);
                    if (selectedBadgeBox) {
                        const overlapsX = boxX < selectedBadgeBox.x + selectedBadgeBox.w && boxX + boxW > selectedBadgeBox.x;
                        const overlapsY = boxY < selectedBadgeBox.y + selectedBadgeBox.h && boxY + boxH > selectedBadgeBox.y;
                        if (overlapsX && overlapsY) {
                            boxY = selectedBadgeBox.y - boxGap - pointerH - boxH;
                            y = boxY + boxH / 2;
                        }
                    }
                    boxY = Math.min(Math.max(boxY, minBoxY), maxBoxY);
                    y = boxY + boxH / 2;
                    const pointerX = Math.min(Math.max(x, boxX + 14), boxX + boxW - 14);
                    const pointerW = 12;

                    ctx.fillStyle = '#15803d';
                    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 11);
                    ctx.fill();
                    ctx.beginPath();
                    if (isNegative) {
                        ctx.moveTo(pointerX - pointerW / 2, boxY + boxH);
                        ctx.lineTo(pointerX + pointerW / 2, boxY + boxH);
                        ctx.lineTo(pointerX, boxY + boxH + pointerH);
                    } else {
                        ctx.moveTo(pointerX - pointerW / 2, boxY);
                        ctx.lineTo(pointerX + pointerW / 2, boxY);
                        ctx.lineTo(pointerX, boxY - pointerH);
                    }
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText(minText, boxX + padX, y + 5);
                    ctx.restore();
                }
            }
        }
    };

    const glassBarsPlugin = {
        id: 'glassBars',
        afterDatasetDraw(chart, args) {
            if (args.index !== 0) return;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data.length) return;
            const ctx = chart.ctx;

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
        }
    };

    const priceChart = new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'zakup',
                type: 'bar',
                data: [],
                borderColor: '#0f766e',
                backgroundColor: '#0f766e',
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 26,
                order: 2
            }, {
                label: 'sprzedaż',
                type: 'line',
                data: [],
                borderColor: '#14532d',
                backgroundColor: (ctx) => sellAreaGradient(ctx.chart),
                borderWidth: 3,
                borderDash: [],
                pointBackgroundColor: '#fff7ed',
                pointBorderColor: '#14532d',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 4,
                tension: 0.32,
                spanGaps: true,
                fill: 'origin',
                hidden: true,
                order: 1
            }]
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
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            onClick: (event, elements, chart) => {
                let hits = elements.length
                    ? elements
                    : chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                if (!hits.length) {
                    hits = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
                }
                const hit = hits[0];
                const dataset = chart.data.datasets[0];

                if (!hit || !dataset) return;

                dataset.selectedIndex = hit.index;
                chart.update('none');
            },
            onHover: (event, elements) => {
                if (event.native?.target) {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
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

    function applyChartMode(mode, updateChart = true) {
        if (chartView !== 'prices') {
            renderView(currentViewIndex);
        }
        chartMode = mode;
        storeChartMode(mode);
        priceChart.setDatasetVisibility(0, mode !== 'sell');
        priceChart.setDatasetVisibility(1, mode !== 'buy');
        chartModeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.chartMode === mode);
        });
        applyYAxisBounds(allChartValues());
        if (updateChart) {
            priceChart.update();
        }
    }

    function renderView(index) {
        const view = views[index];
        const frames = view.frames || [];
        const dayWord = view.label.toLowerCase();

        chartView = 'prices';
        setMetricChartView('prices');
        setYAxisUnit('zł');
        setChartSummaryBadge(null);
        chartTitleEl.textContent = `Ceny energii ${dayWord}`;
        chartInfoEl.textContent = view.info;
        updateNavVisibility();
        applyXAxisDensity();

        if (!frames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = [view.barColor];
            priceChart.data.datasets[0].backgroundColor = [view.barColor];
            priceChart.data.datasets[0].badgeLabel = 'zakup';
            priceChart.data.datasets[0].badgeUnit = 'zł';
            priceChart.data.datasets[0].badgeColor = '#b91c1c';
            priceChart.data.datasets[0].forceBadgeAbove = false;
            priceChart.data.datasets[1].data = [];
            priceChart.data.datasets[1].label = 'sprzedaż';
            priceChart.data.datasets[1].borderColor = view.sellColor;
            priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
            priceChart.data.datasets[1].pointBorderColor = view.sellColor;
            priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
            priceChart.data.datasets[1].badgeUnit = 'zł';
            priceChart.data.datasets[1].badgeColor = '#14532d';
            priceChart.data.datasets[1].yAxisID = 'y';
            priceChart.data.datasets[1].fill = 'origin';
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].selectedIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.options.plugins.tooltip.enabled = false;
            applyYAxisBounds([0]);
            priceChart.update();
            return;
        }

        const labels = frames.map(f => hourAxisLabel(f.start));
        const values = frames.map(f => f.display_price);
        const sellByStart = new Map((view.sellFrames || []).map(f => [String(f.start || ''), f.display_price]));
        const sellValues = frames.map(f => sellByStart.has(String(f.start || '')) ? sellByStart.get(String(f.start || '')) : null);
        const frameRanges = frames.map(f => rangeLabel(f.start, f.end));
        const liveIndex = frames.findIndex(f => f.is_live);
        let minIndex = -1;
        if (view.key === 'tomorrow') {
            let minValue = Number.POSITIVE_INFINITY;
            values.forEach((v, i) => {
                const n = Number(v);
                if (Number.isFinite(n) && n < minValue) {
                    minValue = n;
                    minIndex = i;
                }
            });
        }

        const backgroundColors = frames.map((_, i) => {
            const value = Number(values[i]);
            if (i === liveIndex) return view.liveBarColor;
            if (i === minIndex) return view.minBarColor || '#15803d';
            if (Number.isFinite(value) && value < 0) return view.negativeBarColor || '#84cc16';
            return view.barColor;
        });

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = values;
        priceChart.data.datasets[0].borderColor = backgroundColors;
        priceChart.data.datasets[0].backgroundColor = backgroundColors;
        priceChart.data.datasets[0].badgeLabel = 'zakup';
        priceChart.data.datasets[0].badgeUnit = 'zł';
        priceChart.data.datasets[0].badgeColor = '#b91c1c';
        priceChart.data.datasets[0].forceBadgeAbove = false;
        priceChart.data.datasets[1].data = sellValues;
        priceChart.data.datasets[1].label = 'sprzedaż';
        priceChart.data.datasets[1].borderColor = view.sellColor;
        priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
        priceChart.data.datasets[1].pointBorderColor = view.sellColor;
        priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
        priceChart.data.datasets[1].badgeUnit = 'zł';
        priceChart.data.datasets[1].badgeColor = '#14532d';
        priceChart.data.datasets[1].yAxisID = 'y';
        priceChart.data.datasets[1].fill = 'origin';
        priceChart.data.datasets[0].liveIndex = liveIndex;
        priceChart.data.datasets[0].selectedIndex = liveIndex;
        priceChart.data.datasets[0].minIndex = minIndex;
        priceChart.data.datasets[0].frameRanges = frameRanges;
        priceChart.options.plugins.tooltip.enabled = false;
        applyChartMode(chartMode, false);
        priceChart.update();
    }

    function renderUsageView() {
        chartView = 'usage';
        setMetricChartView('usage');
        setYAxisUnit('kWh');
        chartTitleEl.textContent = 'Zużycie energii dzisiaj';
        chartInfoEl.textContent = 'Dzisiejsze godzinowe zużycie energii.';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        countdownEl.style.display = 'none';
        applyXAxisDensity();

        const frames = Array.isArray(todayUsageFrames) ? todayUsageFrames : [];
        if (!frames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = ['#0f766e'];
            priceChart.data.datasets[0].backgroundColor = ['#0f766e'];
            priceChart.data.datasets[0].badgeLabel = 'zużycie';
            priceChart.data.datasets[0].badgeUnit = 'kWh';
            priceChart.data.datasets[0].badgeColor = '#0f766e';
            priceChart.data.datasets[0].forceBadgeAbove = true;
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].selectedIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.data.datasets[0].frameRanges = [];
            priceChart.data.datasets[1].data = [];
            priceChart.setDatasetVisibility(0, true);
            priceChart.setDatasetVisibility(1, false);
            applyYAxisBounds([0]);
            priceChart.update();
            return;
        }

        const labels = frames.map(f => hourAxisLabel(f.start));
        const values = frames.map(f => f.display_usage);
        const frameRanges = frames.map(f => rangeLabel(f.start, f.end));
        const liveIndex = frames.findIndex(f => f.is_live);
        const selectedIndex = liveIndex >= 0 ? liveIndex : -1;
        const backgroundColors = values.map(() => '#0f766e');
        setChartSummaryBadge(values.reduce((sum, value) => sum + (Number(value) || 0), 0), 'kWh');

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = values;
        priceChart.data.datasets[0].borderColor = backgroundColors;
        priceChart.data.datasets[0].backgroundColor = backgroundColors;
        priceChart.data.datasets[0].badgeLabel = 'zużycie';
        priceChart.data.datasets[0].badgeUnit = 'kWh';
        priceChart.data.datasets[0].badgeColor = '#0f766e';
        priceChart.data.datasets[0].forceBadgeAbove = true;
        priceChart.data.datasets[0].liveIndex = liveIndex;
        priceChart.data.datasets[0].selectedIndex = selectedIndex;
        priceChart.data.datasets[0].minIndex = -1;
        priceChart.data.datasets[0].frameRanges = frameRanges;
        priceChart.data.datasets[1].data = [];
        priceChart.setDatasetVisibility(0, true);
        priceChart.setDatasetVisibility(1, false);
        priceChart.options.plugins.tooltip.enabled = false;
        applyYAxisBounds(values);
        priceChart.update();
    }

    function renderCostView() {
        chartView = 'cost';
        setMetricChartView('cost');
        setYAxisUnit('zł');
        chartTitleEl.textContent = 'Koszt energii dzisiaj';
        chartInfoEl.textContent = 'Dzisiejszy godzinowy koszt energii.';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        countdownEl.style.display = 'none';
        applyXAxisDensity();

        const frames = Array.isArray(todayCostFrames) ? todayCostFrames : [];
        if (!frames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = ['#b91c1c'];
            priceChart.data.datasets[0].backgroundColor = ['#b91c1c'];
            priceChart.data.datasets[0].badgeLabel = 'koszt';
            priceChart.data.datasets[0].badgeUnit = 'zł';
            priceChart.data.datasets[0].badgeColor = '#b91c1c';
            priceChart.data.datasets[0].forceBadgeAbove = true;
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].selectedIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.data.datasets[0].frameRanges = [];
            priceChart.data.datasets[1].data = [];
            priceChart.setDatasetVisibility(0, true);
            priceChart.setDatasetVisibility(1, false);
            applyYAxisBounds([0]);
            priceChart.update();
            return;
        }

        const labels = frames.map(f => hourAxisLabel(f.start));
        const values = frames.map(f => f.display_cost);
        const frameRanges = frames.map(f => rangeLabel(f.start, f.end));
        const liveIndex = frames.findIndex(f => f.is_live);
        const selectedIndex = liveIndex >= 0 ? liveIndex : -1;
        setChartSummaryBadge(values.reduce((sum, value) => sum + (Number(value) || 0), 0), 'zł');
        const backgroundColors = values.map((value, index) => {
            const numeric = Number(value);
            if (index === liveIndex) return '#f59e0b';
            if (Number.isFinite(numeric) && numeric < 0) return '#15803d';
            return '#b91c1c';
        });

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = values;
        priceChart.data.datasets[0].borderColor = backgroundColors;
        priceChart.data.datasets[0].backgroundColor = backgroundColors;
        priceChart.data.datasets[0].badgeLabel = 'koszt';
        priceChart.data.datasets[0].badgeUnit = 'zł';
        priceChart.data.datasets[0].badgeColor = '#b91c1c';
        priceChart.data.datasets[0].forceBadgeAbove = true;
        priceChart.data.datasets[0].liveIndex = liveIndex;
        priceChart.data.datasets[0].selectedIndex = selectedIndex;
        priceChart.data.datasets[0].minIndex = -1;
        priceChart.data.datasets[0].frameRanges = frameRanges;
        priceChart.data.datasets[1].data = [];
        priceChart.setDatasetVisibility(0, true);
        priceChart.setDatasetVisibility(1, false);
        priceChart.options.plugins.tooltip.enabled = false;
        applyYAxisBounds(values);
        priceChart.update();
    }

    function renderMonthUsageView(period = monthUsagePeriod) {
        monthUsagePeriod = period;
        chartView = 'month-usage';
        setMetricChartView('month-usage');
        setYAxisUnit('kWh');
        const usageFrames = fillMonthFrames(
            period === 'previous' ? previousMonthUsageDailyFrames : monthUsageDailyFrames,
            'display_usage',
            period
        );
        const monthLabel = monthHeadingLabel(usageFrames, period);
        chartTitleEl.textContent = `Zużycie energii - ${monthLabel}`;
        setChartSummaryBadge(
            usageFrames.reduce((sum, frame) => sum + (Number(frame.display_usage) || 0), 0),
            'kWh'
        );
        chartInfoEl.textContent = period === 'previous'
            ? 'Dzienne zużycie energii w poprzednim miesiącu.'
            : 'Dzienne zużycie energii od początku bieżącego miesiąca.';
        showMonthToggle(period, 'zużycia energii');
        applyXAxisDensity();

        if (!usageFrames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = ['#0f766e'];
            priceChart.data.datasets[0].backgroundColor = ['#0f766e'];
            priceChart.data.datasets[0].badgeLabel = 'zużycie';
            priceChart.data.datasets[0].badgeUnit = 'kWh';
            priceChart.data.datasets[0].badgeColor = '#0f766e';
            priceChart.data.datasets[0].forceBadgeAbove = true;
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].selectedIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.data.datasets[0].frameRanges = [];
            priceChart.data.datasets[1].data = [];
            priceChart.data.datasets[1].label = 'sprzedaż';
            priceChart.data.datasets[1].borderColor = '#14532d';
            priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
            priceChart.data.datasets[1].pointBorderColor = '#14532d';
            priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
            priceChart.data.datasets[1].badgeUnit = 'zł';
            priceChart.data.datasets[1].badgeColor = '#14532d';
            priceChart.data.datasets[1].fill = 'origin';
            priceChart.setDatasetVisibility(0, true);
            priceChart.setDatasetVisibility(1, false);
            applyYAxisBounds([0]);
            priceChart.update();
            return;
        }

        const labels = usageFrames.map((frame) => dayAxisLabel(frame.start));
        const usageValues = usageFrames.map((frame) => frame.display_usage);
        const frameRanges = usageFrames.map((frame) => rangeLabel(frame.start, frame.end));
        const selectedIndex = -1;

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = usageValues;
        priceChart.data.datasets[0].borderColor = usageValues.map(() => '#0f766e');
        priceChart.data.datasets[0].backgroundColor = usageValues.map(() => '#0f766e');
        priceChart.data.datasets[0].badgeLabel = 'zużycie';
        priceChart.data.datasets[0].badgeUnit = 'kWh';
        priceChart.data.datasets[0].badgeColor = '#0f766e';
        priceChart.data.datasets[0].forceBadgeAbove = true;
        priceChart.data.datasets[0].liveIndex = -1;
        priceChart.data.datasets[0].selectedIndex = selectedIndex;
        priceChart.data.datasets[0].minIndex = -1;
        priceChart.data.datasets[0].frameRanges = frameRanges;
        priceChart.data.datasets[1].data = [];
        priceChart.data.datasets[1].label = 'sprzedaż';
        priceChart.data.datasets[1].borderColor = '#14532d';
        priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
        priceChart.data.datasets[1].pointBorderColor = '#14532d';
        priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
        priceChart.data.datasets[1].badgeUnit = 'zł';
        priceChart.data.datasets[1].badgeColor = '#14532d';
        priceChart.data.datasets[1].fill = 'origin';

        priceChart.setDatasetVisibility(0, true);
        priceChart.setDatasetVisibility(1, false);
        priceChart.options.plugins.tooltip.enabled = false;
        applyYAxisBounds(usageValues);
        priceChart.update();
    }

    function renderMonthCostView(period = monthCostPeriod) {
        monthCostPeriod = period;
        chartView = 'month-cost';
        setMetricChartView('month-cost');
        setYAxisUnit('zł');
        const frames = fillMonthFrames(
            period === 'previous' ? previousMonthCostDailyFrames : monthCostDailyFrames,
            'display_cost',
            period
        );
        const monthLabel = monthHeadingLabel(frames, period);
        chartTitleEl.textContent = `Koszt energii - ${monthLabel}`;
        setChartSummaryBadge(
            frames.reduce((sum, frame) => sum + (Number(frame.display_cost) || 0), 0),
            'zł'
        );
        chartInfoEl.textContent = period === 'previous'
            ? 'Dzienny koszt energii w poprzednim miesiącu.'
            : 'Dzienny koszt energii od początku bieżącego miesiąca.';
        showMonthToggle(period, 'kosztu energii');
        applyXAxisDensity();
        if (!frames.length) {
            priceChart.data.labels = ['Brak danych'];
            priceChart.data.datasets[0].data = [0];
            priceChart.data.datasets[0].borderColor = ['#b91c1c'];
            priceChart.data.datasets[0].backgroundColor = ['#b91c1c'];
            priceChart.data.datasets[0].badgeLabel = 'koszt';
            priceChart.data.datasets[0].badgeUnit = 'zł';
            priceChart.data.datasets[0].badgeColor = '#b91c1c';
            priceChart.data.datasets[0].forceBadgeAbove = true;
            priceChart.data.datasets[0].liveIndex = -1;
            priceChart.data.datasets[0].selectedIndex = -1;
            priceChart.data.datasets[0].minIndex = -1;
            priceChart.data.datasets[0].frameRanges = [];
            priceChart.data.datasets[1].data = [];
            priceChart.data.datasets[1].label = 'sprzedaż';
            priceChart.data.datasets[1].borderColor = '#14532d';
            priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
            priceChart.data.datasets[1].pointBorderColor = '#14532d';
            priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
            priceChart.data.datasets[1].badgeUnit = 'zł';
            priceChart.data.datasets[1].badgeColor = '#14532d';
            priceChart.data.datasets[1].fill = 'origin';
            priceChart.setDatasetVisibility(0, true);
            priceChart.setDatasetVisibility(1, false);
            applyYAxisBounds([0]);
            priceChart.update();
            return;
        }

        const labels = frames.map((frame) => dayAxisLabel(frame.start));
        const values = frames.map((frame) => frame.display_cost);
        const frameRanges = frames.map((frame) => rangeLabel(frame.start, frame.end));
        const selectedIndex = -1;
        const backgroundColors = values.map((value) => {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric < 0) return '#15803d';
            return '#b91c1c';
        });

        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = values;
        priceChart.data.datasets[0].borderColor = backgroundColors;
        priceChart.data.datasets[0].backgroundColor = backgroundColors;
        priceChart.data.datasets[0].badgeLabel = 'koszt';
        priceChart.data.datasets[0].badgeUnit = 'zł';
        priceChart.data.datasets[0].badgeColor = '#b91c1c';
        priceChart.data.datasets[0].forceBadgeAbove = true;
        priceChart.data.datasets[0].liveIndex = -1;
        priceChart.data.datasets[0].selectedIndex = selectedIndex;
        priceChart.data.datasets[0].minIndex = -1;
        priceChart.data.datasets[0].frameRanges = frameRanges;
        priceChart.data.datasets[1].data = [];
        priceChart.data.datasets[1].label = 'sprzedaż';
        priceChart.data.datasets[1].borderColor = '#14532d';
        priceChart.data.datasets[1].backgroundColor = (ctx) => sellAreaGradient(ctx.chart);
        priceChart.data.datasets[1].pointBorderColor = '#14532d';
        priceChart.data.datasets[1].badgeLabel = 'sprzedaż';
        priceChart.data.datasets[1].badgeUnit = 'zł';
        priceChart.data.datasets[1].badgeColor = '#14532d';
        priceChart.data.datasets[1].fill = 'origin';
        priceChart.setDatasetVisibility(0, true);
        priceChart.setDatasetVisibility(1, false);
        priceChart.options.plugins.tooltip.enabled = false;
        applyYAxisBounds(values);
        priceChart.update();
    }

    chartModeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            applyChartMode(btn.dataset.chartMode || 'buy');
        });
    });

    if (todayUsageMetric) {
        todayUsageMetric.addEventListener('click', () => {
            if (chartView === 'usage') {
                renderView(currentViewIndex);
                return;
            }
            renderUsageView();
        });
        todayUsageMetric.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (chartView === 'usage') {
                renderView(currentViewIndex);
                return;
            }
            renderUsageView();
        });
    }

    if (todayCostMetric) {
        todayCostMetric.addEventListener('click', () => {
            if (chartView === 'cost') {
                renderView(currentViewIndex);
                return;
            }
            renderCostView();
        });
        todayCostMetric.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (chartView === 'cost') {
                renderView(currentViewIndex);
                return;
            }
            renderCostView();
        });
    }

    if (monthUsageMetric) {
        monthUsageMetric.addEventListener('click', () => {
            if (chartView === 'month-usage') {
                renderView(currentViewIndex);
                return;
            }
            renderMonthUsageView();
        });
        monthUsageMetric.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (chartView === 'month-usage') {
                renderView(currentViewIndex);
                return;
            }
            renderMonthUsageView();
        });
    }

    if (monthCostMetric) {
        monthCostMetric.addEventListener('click', () => {
            if (chartView === 'month-cost') {
                renderView(currentViewIndex);
                return;
            }
            renderMonthCostView();
        });
        monthCostMetric.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (chartView === 'month-cost') {
                renderView(currentViewIndex);
                return;
            }
            renderMonthCostView();
        });
    }

    async function loadDashboardData() {
        if (!dashboardDataUrl) {
            setDashboardLoading(false);
            return;
        }

        setDashboardLoading(true);

        try {
            const response = await fetch(dashboardDataUrl, {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const payload = await response.json();

            if (!response.ok || payload.ok === false) {
                throw new Error(payload.error || 'Nie udało się pobrać danych.');
            }

            todayFrames = Array.isArray(payload.todayFrames) ? payload.todayFrames : [];
            tomorrowFrames = Array.isArray(payload.tomorrowFrames) ? payload.tomorrowFrames : [];
            todaySellFrames = Array.isArray(payload.todaySellFrames) ? payload.todaySellFrames : [];
            tomorrowSellFrames = Array.isArray(payload.tomorrowSellFrames) ? payload.tomorrowSellFrames : [];
            todayUsageFrames = Array.isArray(payload.todayUsageFrames) ? payload.todayUsageFrames : [];
            todayCostFrames = Array.isArray(payload.todayCostFrames) ? payload.todayCostFrames : [];
            monthUsageDailyFrames = Array.isArray(payload.monthUsageDailyFrames) ? payload.monthUsageDailyFrames : [];
            monthCostDailyFrames = Array.isArray(payload.monthCostDailyFrames) ? payload.monthCostDailyFrames : [];
            previousMonthUsageDailyFrames = Array.isArray(payload.previousMonthUsageDailyFrames) ? payload.previousMonthUsageDailyFrames : [];
            previousMonthCostDailyFrames = Array.isArray(payload.previousMonthCostDailyFrames) ? payload.previousMonthCostDailyFrames : [];
            secondsToPublish = Number(payload.secondsToPublish || secondsToPublish || 0);
            views = createViews();
            currentViewIndex = Math.min(currentViewIndex, views.length - 1);

            updateMetrics(payload.metrics);
            updateMeterSelect(payload.meters, payload.selectedMeterId);
            if (chartView === 'usage') {
                renderUsageView();
            } else if (chartView === 'cost') {
                renderCostView();
            } else if (chartView === 'month-usage') {
                renderMonthUsageView();
            } else if (chartView === 'month-cost') {
                renderMonthCostView();
            } else {
                renderView(currentViewIndex);
            }
        } catch (error) {
            chartInfoEl.textContent = error.message || 'Nie udało się pobrać danych.';
        } finally {
            setDashboardLoading(false);
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentViewIndex > 0) {
            currentViewIndex -= 1;
            renderView(currentViewIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (chartView === 'month-usage') {
            monthUsagePeriod = monthUsagePeriod === 'current' ? 'previous' : 'current';
            renderMonthUsageView(monthUsagePeriod);
            return;
        }
        if (chartView === 'month-cost') {
            monthCostPeriod = monthCostPeriod === 'current' ? 'previous' : 'current';
            renderMonthCostView(monthCostPeriod);
            return;
        }
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

    updateMetrics(data.metrics || {});
    renderView(currentViewIndex);
    setDashboardLoading(false);
})();
