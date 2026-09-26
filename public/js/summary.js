import { formatMoney } from './formatters.js';

export function renderSummary(summary, container) {
  container.replaceChildren();
  const totals = Object.entries(summary.totalsByCurrency);
  if (totals.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'total-currency';
    empty.textContent = 'No balance data yet';
    container.append(empty);
    return;
  }

  for (const [currency, value] of totals) {
    const block = document.createElement('div');
    block.className = 'total-currency';
    const amount = document.createElement('strong');
    amount.textContent = formatMoney(value, currency);
    const label = document.createElement('span');
    label.textContent = `${currency} TOTAL`;
    block.append(amount, label);
    container.append(block);
  }
}
