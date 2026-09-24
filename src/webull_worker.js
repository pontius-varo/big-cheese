import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebullCustomClient } from './custom_sdk/driver.js';
import 'dotenv/config';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_DATABASE_PATH = path.resolve('data/big_cheese.sqlite');

function requiredList(name, env = process.env) {
  const value = env[name];
  if (!value) throw new Error(`${name} must be defined`);
  const values = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must contain at least one value`);
  return values;
}

export function loadWorkerConfig(env = process.env) {
  const appKeys = requiredList('APP_KEYS', env);
  const secrets = requiredList('SECRETS', env);
  if (appKeys.length !== secrets.length) {
    throw new Error('APP_KEYS and SECRETS must contain the same number of values');
  }
  if (!env.TARGET_URL) throw new Error('TARGET_URL must be defined');

  const targetUrl = env.TARGET_URL.replace(/\/$/, '');
  const parsedUrl = new URL(targetUrl.includes('://') ? targetUrl : `https://${targetUrl}`);
  if (parsedUrl.protocol !== 'https:') throw new Error('TARGET_URL must use HTTPS');

  const intervalMs = env.WORKER_INTERVAL_MS
    ? Number.parseInt(env.WORKER_INTERVAL_MS, 10)
    : DEFAULT_INTERVAL_MS;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000) {
    throw new Error('WORKER_INTERVAL_MS must be an integer of at least 1000');
  }

  return {
    credentials: appKeys.map((appKey, index) => ({ appKey, secret: secrets[index] })),
    targetUrl: parsedUrl.toString().replace(/\/$/, ''),
    databasePath: path.resolve(env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH),
    intervalMs,
  };
}

function stableSourceId(appKey) {
  return createHash('sha256').update(appKey).digest('hex');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.positions)) return value.positions;
  return value == null ? [] : [value];
}

function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function numericValue(object, keys) {
  const value = firstValue(object, keys);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Transform API responses into stable records while retaining the original payloads.
export function organizeAccountData(accountData, collectedAt = new Date().toISOString()) {
  if (!accountData?.sourceId || !Array.isArray(accountData.subAccounts)) {
    throw new TypeError('accountData must contain sourceId and subAccounts');
  }

  return {
    sourceId: accountData.sourceId,
    collectedAt,
    accounts: accountData.subAccounts.map(({ subAccount, assets, positions }) => {
      const accountId = String(firstValue(subAccount, ['account_id', 'accountId', 'id']) ?? '');
      if (!accountId) throw new Error('Webull returned an account without an account ID');

      const asset = Array.isArray(assets) ? assets[0] : (assets?.data ?? assets ?? {});
      return {
        accountId,
        accountType: firstValue(subAccount, ['account_type', 'accountType', 'type']),
        currency: firstValue(asset, ['currency', 'currency_code', 'currencyCode']),
        totalValue: numericValue(asset, [
          'total_market_value', 'totalMarketValue', 'net_liquidation_value',
          'netLiquidationValue', 'total_asset', 'totalAsset', 'account_value', 'accountValue',
        ]),
        assets,
        account: subAccount,
        positions: asArray(positions).map((position) => ({
          symbol: firstValue(position, ['symbol', 'ticker', 'instrument_id', 'instrumentId']),
          quantity: numericValue(position, ['quantity', 'qty', 'position', 'position_qty', 'positionQty']),
          marketValue: numericValue(position, ['market_value', 'marketValue']),
          raw: position,
        })),
      };
    }),
  };
}

export async function mineAccountData(appKey, secret, targetUrl, Client = WebullCustomClient) {
  const client = new Client(appKey, secret, targetUrl);
  const subAccounts = asArray(await client.getAccountList());

  const collectedAccounts = await Promise.all(subAccounts.map(async (subAccount) => {
    const subAccountId = firstValue(subAccount, ['account_id', 'accountId', 'id']);
    if (subAccountId === null) throw new Error('Webull returned an account without an account ID');

    const [assets, positions] = await Promise.all([
      client.getAccountAssets(subAccountId),
      client.getAccountPositions(subAccountId),
    ]);
    return { subAccount, assets, positions };
  }));

  return { sourceId: stableSourceId(appKey), subAccounts: collectedAccounts };
}

export function initializeDatabase(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL, collected_at TEXT NOT NULL,
      account_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      source_id TEXT NOT NULL, account_id TEXT NOT NULL, account_type TEXT,
      raw_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (source_id, account_id)
    );
    CREATE TABLE IF NOT EXISTS balance_snapshots (
      run_id TEXT NOT NULL, source_id TEXT NOT NULL, account_id TEXT NOT NULL,
      collected_at TEXT NOT NULL, currency TEXT, total_value REAL, raw_json TEXT NOT NULL,
      PRIMARY KEY (run_id, account_id), FOREIGN KEY (run_id) REFERENCES ingestion_runs(id)
    );
    CREATE TABLE IF NOT EXISTS position_snapshots (
      run_id TEXT NOT NULL, source_id TEXT NOT NULL, account_id TEXT NOT NULL,
      position_index INTEGER NOT NULL, collected_at TEXT NOT NULL, symbol TEXT,
      quantity REAL, market_value REAL, raw_json TEXT NOT NULL,
      PRIMARY KEY (run_id, account_id, position_index),
      FOREIGN KEY (run_id) REFERENCES ingestion_runs(id)
    );
    CREATE INDEX IF NOT EXISTS balance_history
      ON balance_snapshots(source_id, account_id, collected_at);
    CREATE INDEX IF NOT EXISTS position_history
      ON position_snapshots(source_id, account_id, collected_at);
  `);
}

export function pushAccountData(db, data) {
  const runId = randomUUID();
  const insertRun = db.prepare('INSERT INTO ingestion_runs (id, source_id, collected_at, account_count) VALUES (?, ?, ?, ?)');
  const upsertAccount = db.prepare(`
    INSERT INTO accounts (source_id, account_id, account_type, raw_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, account_id) DO UPDATE SET
      account_type = excluded.account_type, raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `);
  const insertBalance = db.prepare(`
    INSERT INTO balance_snapshots
      (run_id, source_id, account_id, collected_at, currency, total_value, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPosition = db.prepare(`
    INSERT INTO position_snapshots
      (run_id, source_id, account_id, position_index, collected_at, symbol, quantity, market_value, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    insertRun.run(runId, data.sourceId, data.collectedAt, data.accounts.length);
    for (const account of data.accounts) {
      upsertAccount.run(data.sourceId, account.accountId, account.accountType,
        JSON.stringify(account.account), data.collectedAt);
      insertBalance.run(runId, data.sourceId, account.accountId, data.collectedAt,
        account.currency, account.totalValue, JSON.stringify(account.assets));
      account.positions.forEach((position, index) => {
        insertPosition.run(runId, data.sourceId, account.accountId, index, data.collectedAt,
          position.symbol, position.quantity, position.marketValue, JSON.stringify(position.raw));
      });
    }
    db.exec('COMMIT');
    return runId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function runWorkerCycle(config, db, Client = WebullCustomClient) {
  const startedAt = new Date();
  const results = [];
  for (const { appKey, secret } of config.credentials) {
    const raw = await mineAccountData(appKey, secret, config.targetUrl, Client);
    const organized = organizeAccountData(raw);
    results.push({ runId: pushAccountData(db, organized), accountCount: organized.accounts.length });
  }

  console.info('Webull ingestion completed', {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    sources: results.length,
    accounts: results.reduce((sum, result) => sum + result.accountCount, 0),
  });
  return results;
}

export async function main() {
  const config = loadWorkerConfig();
  await mkdir(path.dirname(config.databasePath), { recursive: true });
  const db = new DatabaseSync(config.databasePath);
  initializeDatabase(db);

  let activeCycle = null;
  const cycle = () => {
    if (activeCycle) {
      console.warn('Skipping Webull ingestion because the previous cycle is still running');
      return activeCycle;
    }
    activeCycle = runWorkerCycle(config, db)
      .catch((error) => {
        console.error('Webull ingestion failed', { message: error.message, stack: error.stack });
        process.exitCode = 1;
      })
      .finally(() => {
        activeCycle = null;
      });
    return activeCycle;
  };

  await cycle();
  if (process.argv.includes('--once')) {
    db.close();
    return;
  }

  const timer = setInterval(cycle, config.intervalMs);
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; stopping Webull worker`);
    clearInterval(timer);
    await activeCycle;
    db.close();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

const isEntryPoint = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) await main();
