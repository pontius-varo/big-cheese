import { renderAccounts } from './accounts.js';
import { api } from './api.js';
import { renderComposition, renderCompositionLoading } from './composition.js';
import { formatDate, maskAccount } from './formatters.js';
import { renderHistory } from './history-chart.js';
import { renderSummary } from './summary.js';

const elements = {
  totals: document.querySelector('#summary-totals'),
  accountList: document.querySelector('#account-list'),
  accountCount: document.querySelector('#account-count'),
  composition: document.querySelector('#composition'),
  selectedAccount: document.querySelector('#selected-account'),
  history: document.querySelector('#history-chart'),
  updated: document.querySelector('#last-updated'),
  refresh: document.querySelector('#refresh-button'),
  notice: document.querySelector('#notice'),
  bucketButtons: [...document.querySelectorAll('[data-bucket]')],
};

const state = { summary: null, selectedAccount: null, bucket: 'hour', loading: false };

function showError(error) {
  elements.notice.textContent = error.message ?? 'Something went wrong';
  elements.notice.hidden = false;
}

function clearError() {
  elements.notice.hidden = true;
  elements.notice.textContent = '';
}

async function loadComposition(account) {
  state.selectedAccount = account;
  elements.selectedAccount.textContent = maskAccount(account.accountId);
  renderAccounts(state.summary.accounts, elements.accountList, account, loadComposition);
  renderCompositionLoading(elements.composition);
  try {
    renderComposition(await api.composition(account), elements.composition);
  } catch (error) {
    showError(error);
    elements.composition.innerHTML = '<div class="empty-state"><p>Positions could not be loaded.</p></div>';
  }
}

async function loadHistory() {
  elements.history.innerHTML = '<div class="empty-state"><p>Loading history…</p></div>';
  try {
    renderHistory(await api.history({ bucket: state.bucket }), elements.history);
  } catch (error) {
    showError(error);
    elements.history.innerHTML = '<div class="empty-state"><p>History could not be loaded.</p></div>';
  }
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  elements.refresh.disabled = true;
  elements.refresh.classList.add('is-loading');
  elements.refresh.setAttribute('aria-busy', 'true');
  clearError();
  try {
    const summary = await api.summary();
    state.summary = summary;
    renderSummary(summary, elements.totals);
    elements.accountCount.textContent = summary.accountCount;
    elements.updated.textContent = summary.collectedAt
      ? `Updated ${formatDate(summary.collectedAt)}`
      : 'Waiting for data';
    const stillPresent = summary.accounts.find((account) => (
      account.sourceId === state.selectedAccount?.sourceId
        && account.accountId === state.selectedAccount?.accountId
    ));
    state.selectedAccount = stillPresent ?? summary.accounts[0] ?? null;
    renderAccounts(summary.accounts, elements.accountList, state.selectedAccount, loadComposition);
    await Promise.all([
      loadHistory(),
      state.selectedAccount ? loadComposition(state.selectedAccount) : Promise.resolve(),
    ]);
  } catch (error) {
    showError(error);
  } finally {
    state.loading = false;
    elements.refresh.disabled = false;
    elements.refresh.classList.remove('is-loading');
    elements.refresh.removeAttribute('aria-busy');
  }
}

elements.refresh.addEventListener('click', refresh);
elements.bucketButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.bucket = button.dataset.bucket;
    elements.bucketButtons.forEach((item) => item.classList.toggle('active', item === button));
    void loadHistory();
  });
});

void refresh();
