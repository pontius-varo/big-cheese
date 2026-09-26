import { formatDate, formatMoney } from './formatters.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#65d295', '#f2b936', '#b98ee6', '#ff8d82'];

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

export function renderHistory(history, container) {
  container.replaceChildren();
  if (!history.points.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span aria-hidden="true">⌁</span><p>History will appear after snapshots are collected.</p>';
    container.append(empty);
    return;
  }

  const width = 760;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 34, left: 68 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const timestamps = [...new Set(history.points.map((point) => point.collectedAt))].sort();
  const currencies = [...new Set(history.points.map((point) => point.currency))];
  const maximum = Math.max(...history.points.map((point) => point.totalValue ?? 0), 1);
  const x = (timestamp) => padding.left + (timestamps.length === 1
    ? plotWidth / 2
    : (timestamps.indexOf(timestamp) / (timestamps.length - 1)) * plotWidth);
  const y = (value) => padding.top + plotHeight - ((value ?? 0) / maximum) * plotHeight;

  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `Portfolio history with ${timestamps.length} time points`,
  });
  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', { id: 'history-gradient', x1: '0', y1: '0', x2: '0', y2: '1' });
  gradient.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#65d295', 'stop-opacity': '.2' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#65d295', 'stop-opacity': '0' }),
  );
  defs.append(gradient);
  svg.append(defs);

  for (let index = 0; index <= 4; index += 1) {
    const gridY = padding.top + (plotHeight / 4) * index;
    svg.append(svgElement('line', { x1: padding.left, y1: gridY, x2: width - padding.right, y2: gridY, class: 'chart-grid' }));
    const label = svgElement('text', { x: padding.left - 10, y: gridY + 4, 'text-anchor': 'end', class: 'chart-label' });
    label.textContent = formatMoney(maximum * (1 - index / 4), currencies[0]);
    svg.append(label);
  }

  currencies.forEach((currency, currencyIndex) => {
    const points = history.points.filter((point) => point.currency === currency)
      .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
    const coordinates = points.map((point) => `${x(point.collectedAt)},${y(point.totalValue)}`);
    if (currencies.length === 1 && coordinates.length > 1) {
      const area = `${padding.left},${padding.top + plotHeight} ${coordinates.join(' ')} ${width - padding.right},${padding.top + plotHeight}`;
      svg.append(svgElement('polygon', { points: area, class: 'chart-area' }));
    }
    const line = svgElement('polyline', { points: coordinates.join(' '), class: 'chart-line' });
    line.style.stroke = COLORS[currencyIndex % COLORS.length];
    svg.append(line);
    for (const point of points) {
      const dot = svgElement('circle', { cx: x(point.collectedAt), cy: y(point.totalValue), r: 3.5, class: 'chart-dot' });
      dot.style.stroke = COLORS[currencyIndex % COLORS.length];
      const title = svgElement('title');
      title.textContent = `${formatDate(point.collectedAt)} · ${formatMoney(point.totalValue, currency)}`;
      dot.append(title);
      svg.append(dot);
    }
  });

  const firstLabel = svgElement('text', { x: padding.left, y: height - 8, class: 'chart-label' });
  firstLabel.textContent = formatDate(timestamps[0], false);
  const lastLabel = svgElement('text', { x: width - padding.right, y: height - 8, 'text-anchor': 'end', class: 'chart-label' });
  lastLabel.textContent = formatDate(timestamps.at(-1), false);
  svg.append(firstLabel, lastLabel);
  container.append(svg);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  currencies.forEach((currency, index) => {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'legend-dot';
    dot.style.background = COLORS[index % COLORS.length];
    item.append(dot, document.createTextNode(currency));
    legend.append(item);
  });
  container.append(legend);
}
