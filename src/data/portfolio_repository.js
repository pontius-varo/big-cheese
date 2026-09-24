export class PortfolioRepository {
  constructor(db) {
    this.db = db;
  }

  getLatestBalances(accountId = null) {
    const where = accountId === null ? '' : 'WHERE account_id = ?';
    const parameters = accountId === null ? [] : [accountId];
    return this.db.prepare(`
      WITH ranked AS (
        SELECT source_id, account_id, collected_at, currency, total_value, run_id,
          ROW_NUMBER() OVER (
            PARTITION BY source_id, account_id ORDER BY collected_at DESC, run_id DESC
          ) AS row_number
        FROM balance_snapshots
        ${where}
      )
      SELECT source_id, account_id, collected_at, currency, total_value, run_id
      FROM ranked
      WHERE row_number = 1
      ORDER BY account_id
    `).all(...parameters);
  }

  getPositions(runId, sourceId, accountId) {
    return this.db.prepare(`
      SELECT symbol, quantity, market_value
      FROM position_snapshots
      WHERE run_id = ? AND source_id = ? AND account_id = ?
      ORDER BY market_value DESC, position_index
    `).all(runId, sourceId, accountId);
  }

  getHistory({ bucket, limit, sourceId, accountId }) {
    const bucketExpression = bucket === 'day'
      ? "strftime('%Y-%m-%dT00:00:00Z', collected_at)"
      : "strftime('%Y-%m-%dT%H:00:00Z', collected_at)";
    const filters = [];
    const parameters = [];
    if (sourceId) {
      filters.push('source_id = ?');
      parameters.push(sourceId);
    }
    if (accountId) {
      filters.push('account_id = ?');
      parameters.push(accountId);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    return this.db.prepare(`
      WITH bucketed AS (
        SELECT source_id, account_id, currency, total_value, collected_at,
          ${bucketExpression} AS bucket_at,
          ROW_NUMBER() OVER (
            PARTITION BY ${bucketExpression}, source_id, account_id
            ORDER BY collected_at DESC, run_id DESC
          ) AS row_number
        FROM balance_snapshots
        ${where}
      ), limited_buckets AS (
        SELECT DISTINCT bucket_at FROM bucketed ORDER BY bucket_at DESC LIMIT ?
      ), totals AS (
        SELECT bucket_at, COALESCE(currency, 'UNKNOWN') AS currency,
          SUM(total_value) AS total_value, COUNT(*) AS account_count
        FROM bucketed
        WHERE row_number = 1
          AND bucket_at IN (SELECT bucket_at FROM limited_buckets)
        GROUP BY bucket_at, COALESCE(currency, 'UNKNOWN')
      )
      SELECT bucket_at, currency, total_value, account_count
      FROM totals
      ORDER BY bucket_at DESC, currency
    `).all(...parameters, limit);
  }
}
