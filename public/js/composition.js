import { formatMoney, formatNumber } from './formatters.js';

function cell(row, value, className = '') {
  const element = document.createElement('td');
  element.className = className;
  element.textContent = value;
  row.append(element);
  return element;
}

export function renderComposition(data, container) {
  container.replaceChildren();
  if (!data.positions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span aria-hidden="true">○</span><p>No open positions in this account.</p>';
    container.append(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'position-table';
  table.innerHTML = '<thead><tr><th>Asset</th><th>Quantity</th><th>Value</th><th>Allocation</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const position of data.positions) {
    const row = document.createElement('tr');
    cell(row, position.symbol ?? 'Unknown', 'symbol');
    cell(row, formatNumber(position.quantity));
    cell(row, formatMoney(position.marketValue, data.currency));
    const allocation = cell(row, '', 'allocation');
    const bar = document.createElement('span');
    bar.className = 'allocation-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(0, Math.min(100, (position.weight ?? 0) * 100))}%`;
    bar.append(fill);
    allocation.append(bar, document.createTextNode(
      position.weight === null ? '—' : `${(position.weight * 100).toFixed(1)}%`,
    ));
    body.append(row);
  }
  table.append(body);
  container.append(table);
}

export function renderCompositionLoading(container) {
  container.innerHTML = '<div class="empty-state"><p>Loading positions…</p></div>';
}
