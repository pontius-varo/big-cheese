import { formatDate, formatMoney, maskAccount } from './formatters.js';

export function renderAccounts(accounts, container, selected, onSelect) {
  container.replaceChildren();
  if (accounts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>No account snapshots yet.<br>Run the worker to collect data.</p>';
    container.append(empty);
    return;
  }

  for (const account of accounts) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'account-button';
    button.classList.toggle('active', selected?.sourceId === account.sourceId
      && selected?.accountId === account.accountId);
    button.setAttribute('aria-pressed', button.classList.contains('active'));

    const top = document.createElement('span');
    top.className = 'account-top';
    const name = document.createElement('span');
    name.className = 'account-name';
    name.textContent = maskAccount(account.accountId);
    const value = document.createElement('span');
    value.className = 'account-value';
    value.textContent = formatMoney(account.totalValue, account.currency);
    top.append(name, value);

    const meta = document.createElement('span');
    meta.className = 'account-meta';
    meta.textContent = `Updated ${formatDate(account.collectedAt)}`;
    button.append(top, meta);
    button.addEventListener('click', () => onSelect(account));
    container.append(button);
  }
}
