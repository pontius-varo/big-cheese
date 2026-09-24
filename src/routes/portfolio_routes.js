import { Router } from 'express';

function serializeBalance(row) {
  return {
    sourceId: row.source_id,
    accountId: row.account_id,
    collectedAt: row.collected_at,
    currency: row.currency,
    totalValue: row.total_value,
  };
}

function totalsByCurrency(rows) {
  const totals = new Map();
  for (const row of rows) {
    const currency = row.currency ?? 'UNKNOWN';
    if (row.total_value !== null) {
      totals.set(currency, (totals.get(currency) ?? 0) + row.total_value);
    }
  }
  return Object.fromEntries(totals);
}

function findAccount(repository, accountId, sourceId) {
  const matches = repository.getLatestBalances(accountId)
    .filter((row) => !sourceId || row.source_id === sourceId);
  if (matches.length === 0) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }
  if (matches.length > 1) {
    const error = new Error('Account ID is ambiguous; provide the sourceId query parameter');
    error.status = 409;
    throw error;
  }
  return matches[0];
}

function parseHistoryOptions(query) {
  const bucket = query.bucket ?? 'hour';
  if (!['hour', 'day'].includes(bucket)) {
    const error = new Error('bucket must be either "hour" or "day"');
    error.status = 400;
    throw error;
  }
  const limit = query.limit === undefined ? 168 : Number.parseInt(query.limit, 10);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2_000) {
    const error = new Error('limit must be an integer between 1 and 2000');
    error.status = 400;
    throw error;
  }
  return { bucket, limit };
}

export function createPortfolioRouter(repository) {
  const router = Router();

  router.get('/summary', (_request, response) => {
    const rows = repository.getLatestBalances();
    response.json({
      collectedAt: rows.reduce((latest, row) => (
        !latest || row.collected_at > latest ? row.collected_at : latest
      ), null),
      accountCount: rows.length,
      totalsByCurrency: totalsByCurrency(rows),
      accounts: rows.map(serializeBalance),
    });
  });

  router.get('/accounts', (_request, response) => {
    response.json({ accounts: repository.getLatestBalances().map(serializeBalance) });
  });

  router.get('/accounts/:accountId', (request, response) => {
    response.json(serializeBalance(findAccount(
      repository, request.params.accountId, request.query.sourceId,
    )));
  });

  router.get('/accounts/:accountId/composition', (request, response) => {
    const account = findAccount(repository, request.params.accountId, request.query.sourceId);
    const positions = repository.getPositions(
      account.run_id, account.source_id, account.account_id,
    );
    const knownMarketValue = positions.reduce(
      (total, position) => total + (position.market_value ?? 0), 0,
    );
    response.json({
      ...serializeBalance(account),
      positions: positions.map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        marketValue: position.market_value,
        weight: position.market_value !== null && knownMarketValue > 0
          ? position.market_value / knownMarketValue
          : null,
      })),
    });
  });

  router.get('/history', (request, response) => {
    const options = {
      ...parseHistoryOptions(request.query),
      sourceId: request.query.sourceId,
      accountId: request.query.accountId,
    };
    const rows = repository.getHistory(options);
    response.json({
      bucket: options.bucket,
      points: rows.reverse().map((row) => ({
        collectedAt: row.bucket_at,
        currency: row.currency,
        totalValue: row.total_value,
        accountCount: row.account_count,
      })),
    });
  });

  return router;
}
