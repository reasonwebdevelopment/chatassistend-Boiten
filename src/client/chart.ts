interface Conversation {
  id: number;
  created_at: string;
}

interface DayStats {
  isoDate: string;
  label: string;
  messages: number;
  conversations: number;
}

interface ChartPoint extends DayStats {
  label: string;
  value: number;
}

const chartCanvas = document.getElementById(
  "stats-chart",
) as HTMLCanvasElement | null;
const chartLegend = document.getElementById(
  "chart-legend",
) as HTMLElement | null;

let tooltipEl: HTMLDivElement | null = null;
let lastPoints: ChartPoint[] = [];
let lastBarBounds: Array<{
  x: number;
  width: number;
  centerX: number;
  day: DayStats;
}> = [];
let hoverIdx = -1;
let lastCanvasWidth = 0;

function chartColors() {
  const isLight = document.body.dataset.theme === "light";
  return {
    bg: isLight ? "rgba(255,255,255,0.95)" : "rgba(21,24,32,0.95)",
    grid: isLight ? "rgba(31,35,43,0.08)" : "rgba(226,232,240,0.08)",
    axis: isLight ? "rgba(31,35,43,0.28)" : "rgba(226,232,240,0.28)",
    line: isLight ? "#2f6df6" : "#4f8ef7",
    fillTop: isLight ? "rgba(47,109,246,0.24)" : "rgba(79,142,247,0.28)",
    fillBottom: isLight ? "rgba(47,109,246,0.02)" : "rgba(79,142,247,0.02)",
    point: isLight ? "#1f232b" : "#e2e8f0",
    text: isLight ? "#667085" : "#8892a4",
    tooltipBg: isLight ? "rgba(255,255,255,0.98)" : "rgba(21,24,32,0.98)",
    tooltipBorder: isLight ? "rgba(31,35,43,0.12)" : "rgba(226,232,240,0.14)",
    tooltipText: isLight ? "#1f232b" : "#e2e8f0",
    barMsgs: isLight ? "#2f6df6" : "#4f8ef7",
  };
}

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "chart-tooltip";
    tooltipEl.style.cssText = `
      position: fixed;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 120ms ease, transform 120ms ease;
      z-index: 999;
      padding: 8px 12px;
      border-radius: 8px;
      font: 12px/1.6 Biryani, sans-serif;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    `;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(e: MouseEvent, day: DayStats): void {
  const c = chartColors();
  const tip = getTooltip();
  tip.style.background = c.tooltipBg;
  tip.style.border = `1px solid ${c.tooltipBorder}`;
  tip.style.color = c.tooltipText;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:2px;color:${c.barMsgs}">${day.isoDate}</div>
    <div>💬 <b>${day.messages}</b> berichten</div>
    <div>🗂 <b>${day.conversations}</b> gesprek${day.conversations !== 1 ? "ken" : ""}</div>
  `;

  const TW = tip.offsetWidth || 160;
  const TH = tip.offsetHeight || 72;
  let tx = e.clientX + 14;
  let ty = e.clientY - TH / 2;
  if (tx + TW > window.innerWidth - 8) tx = e.clientX - TW - 14;
  if (ty < 8) ty = 8;
  if (ty + TH > window.innerHeight - 8) ty = window.innerHeight - TH - 8;

  tip.style.left = `${tx}px`;
  tip.style.top = `${ty}px`;
  tip.style.opacity = "1";
  tip.style.transform = "translateY(0)";
}

function hideTooltip(): void {
  const tip = getTooltip();
  tip.style.opacity = "0";
  tip.style.transform = "translateY(4px)";
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(220, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  lastCanvasWidth = rect.width;
  return ctx;
}

function buildLegend(points: ChartPoint[]): void {
  if (!chartLegend) return;

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const maxPoint = points.reduce(
    (best, point) => (point.value > best.value ? point : best),
    points[0] ?? { label: "", value: 0 },
  );

  chartLegend.innerHTML = `
    <span class="chart-legend__item"><span class="chart-legend__dot"></span>${points.length} gesprekken</span>
    <span class="chart-legend__item"><span class="chart-legend__dot chart-legend__dot--accent"></span>${total.toLocaleString("nl-NL")} berichten</span>
    <span class="chart-legend__item"><span class="chart-legend__dot chart-legend__dot--muted"></span>${maxPoint.value.toLocaleString("nl-NL")} max. in ${maxPoint.label}</span>
  `;
}

function drawChart(points: ChartPoint[], activeIndex = -1): void {
  if (!chartCanvas) return;

  const ctx = resizeCanvas(chartCanvas);
  if (!ctx) return;

  const { width, height } = chartCanvas;
  const colors = chartColors();
  const padding = { top: 20, right: 18, bottom: 44, left: 44 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(
    0,
    padding.top,
    0,
    height - padding.bottom,
  );
  gradient.addColorStop(0, colors.fillTop);
  gradient.addColorStop(1, colors.fillBottom);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  if (points.length === 0) {
    ctx.fillStyle = colors.text;
    ctx.font = '600 14px "Biryani", sans-serif';
    ctx.fillText(
      "Nog geen statistieken beschikbaar",
      padding.left + 8,
      padding.top + 28,
    );
    return;
  }

  const slotWidth = plotWidth / Math.max(1, points.length);
  const barWidth = Math.max(10, Math.min(56, slotWidth * 0.64));
  const values: Array<{ x: number; y: number; width: number; day: DayStats }> =
    [];

  points.forEach((point, index) => {
    const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const barHeight = (point.value / maxValue) * plotHeight;
    const y = padding.top + plotHeight - barHeight;
    values.push({ x, y, width: barWidth, day: point });
  });

  lastBarBounds = values.map((bar) => ({
    x: bar.x,
    width: bar.width,
    centerX: bar.x + bar.width / 2,
    day: bar.day,
  }));

  values.forEach((bar, index) => {
    const barHeight = height - padding.bottom - bar.y;
    const isActive = index === activeIndex;

    ctx.beginPath();
    ctx.roundRect(bar.x, bar.y, bar.width, Math.max(0, barHeight), 10);
    ctx.fillStyle = isActive ? colors.line : gradient;
    ctx.fill();

    if (isActive) {
      ctx.save();
      ctx.shadowColor = "rgba(79, 142, 247, 0.35)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = colors.line;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(
        bar.x - 1,
        bar.y - 1,
        bar.width + 2,
        Math.max(0, barHeight) + 2,
      );
      ctx.restore();
    }

    ctx.beginPath();
    ctx.roundRect(bar.x, bar.y, bar.width, Math.max(0, barHeight), 10);
    ctx.strokeStyle = isActive ? colors.axis : colors.grid;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();

    if (
      index % Math.max(1, Math.ceil(points.length / 6)) === 0 ||
      index === points.length - 1
    ) {
      ctx.save();
      ctx.fillStyle = colors.text;
      ctx.font = '500 11px "Biryani", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(bar.day.label, bar.x + bar.width / 2, height - 18);
      ctx.restore();
    }
  });

  if (activeIndex >= 0 && values[activeIndex]) {
    const active = values[activeIndex];
    const barHeight = height - padding.bottom - active.y;
    ctx.save();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      active.x - 2,
      active.y - 2,
      active.width + 4,
      Math.max(0, barHeight) + 4,
    );
    ctx.restore();
  }
}

function setChartPoints(
  conversations: Conversation[],
  counts: number[],
): ChartPoint[] {
  const grouped = new Map<
    string,
    { label: string; messages: number; conversations: number; isoDate: string }
  >();

  conversations.forEach((conversation, index) => {
    const date = new Date(conversation.created_at);
    const isoDate = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
    });
    const current = grouped.get(isoDate) ?? {
      label,
      messages: 0,
      conversations: 0,
      isoDate,
    };

    current.messages += counts[index] ?? 0;
    current.conversations += 1;
    grouped.set(isoDate, current);
  });

  return [...grouped.values()]
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map((day) => ({
      ...day,
      value: day.messages,
    }));
}

export function renderChart(
  conversations: Conversation[],
  counts: number[],
): void {
  lastPoints = setChartPoints(conversations, counts);
  buildLegend(lastPoints);
  hoverIdx = -1;
  drawChart(lastPoints, hoverIdx);
}

export function refreshChart(
  conversations: Conversation[],
  counts: number[],
): void {
  if (conversations.length > 0 && counts.length > 0) {
    lastPoints = setChartPoints(conversations, counts);
  }
  buildLegend(lastPoints);
  drawChart(lastPoints, hoverIdx);
}

function getPointFromMouseEvent(
  event: MouseEvent,
): { x: number; y: number } | null {
  if (!chartCanvas) return null;
  const rect = chartCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const scaleX = chartCanvas.width / rect.width;
  const scaleY = chartCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function nearestHit(event: MouseEvent): number {
  const point = getPointFromMouseEvent(event);
  if (!point) return -1;

  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < lastBarBounds.length; i++) {
    const hit = lastBarBounds[i];
    const withinX = point.x >= hit.x && point.x <= hit.x + hit.width;
    if (!withinX) continue;

    const dx = hit.centerX - point.x;
    const dy = 0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < nearestDistance) {
      nearest = i;
      nearestDistance = distance;
    }
  }

  return nearest;
}

if (chartCanvas) {
  chartCanvas.addEventListener("mousemove", (event) => {
    const found = nearestHit(event);

    if (found >= 0 && lastBarBounds[found]) {
      const day = lastBarBounds[found].day;
      showTooltip(event, day);
      chartCanvas.style.cursor = "crosshair";
    } else {
      hideTooltip();
      chartCanvas.style.cursor = "default";
    }

    if (found !== hoverIdx) {
      hoverIdx = found;
      drawChart(lastPoints, hoverIdx);
    }
  });

  chartCanvas.addEventListener("mouseleave", () => {
    hoverIdx = -1;
    drawChart(lastPoints, hoverIdx);
    hideTooltip();
    chartCanvas.style.cursor = "default";
  });
}

window.addEventListener("resize", () => {
  if (
    chartCanvas &&
    Math.abs(chartCanvas.getBoundingClientRect().width - lastCanvasWidth) > 1
  ) {
    document.dispatchEvent(new Event("chart:resize"));
  }
});

document.addEventListener("chart:resize", () => {
  drawChart(lastPoints, hoverIdx);
});

export {};
