export function formatMoney(value, currency = 'USD') {
  if (value === null || value === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${Number(value).toLocaleString()} ${currency}`;
  }
}

export function formatNumber(value) {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

export function formatDate(value, includeTime = true) {
  if (!value) return 'Not collected yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

export function maskAccount(accountId) {
  const id = String(accountId);
  return id.length <= 4 ? id : `•••• ${id.slice(-4)}`;
}
