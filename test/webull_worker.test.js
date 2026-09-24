import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  initializeDatabase,
  loadWorkerConfig,
  mineAccountData,
  organizeAccountData,
  pushAccountData,
} from '../src/webull_worker.js';

const env = {
  APP_KEYS: 'key-one,key-two',
  SECRETS: 'secret-one,secret-two',
  TARGET_URL: 'https://api.example.com/',
};

test('loadWorkerConfig validates and normalizes configuration', () => {
  const config = loadWorkerConfig(env);
  assert.equal(config.credentials.length, 2);
  assert.equal(config.targetUrl, 'https://api.example.com');
  assert.equal(config.intervalMs, 3_600_000);
});

test('loadWorkerConfig rejects mismatched credentials', () => {
  assert.throws(() => loadWorkerConfig({ ...env, SECRETS: 'only-one' }), /same number/);
});

class FakeClient {
  async getAccountList() {
    return [{ account_id: 'account-1', account_type: 'CASH' }];
  }
  async getAccountAssets() {
    return { currency: 'USD', total_market_value: '125.50' };
  }
  async getAccountPositions() {
    return [{ symbol: 'ABC', quantity: '2', market_value: '25.50' }];
  }
}

test('mineAccountData and organizeAccountData normalize API data', async () => {
  const raw = await mineAccountData('key', 'secret', env.TARGET_URL, FakeClient);
  const data = organizeAccountData(raw, '2026-01-01T00:00:00.000Z');
  assert.equal(data.accounts[0].accountId, 'account-1');
  assert.equal(data.accounts[0].totalValue, 125.5);
  assert.deepEqual(data.accounts[0].positions[0], {
    symbol: 'ABC', quantity: 2, marketValue: 25.5,
    raw: { symbol: 'ABC', quantity: '2', market_value: '25.50' },
  });
});

test('pushAccountData persists an atomic account snapshot', () => {
  const db = new DatabaseSync(':memory:');
  initializeDatabase(db);
  const data = organizeAccountData({
    sourceId: 'source',
    subAccounts: [{
      subAccount: { account_id: 'account-1' },
      assets: { currency: 'USD', total_asset: '42' },
      positions: [{ symbol: 'XYZ', quantity: '3' }],
    }],
  }, '2026-01-01T00:00:00.000Z');

  const runId = pushAccountData(db, data);
  assert.ok(runId);
  assert.equal(db.prepare('SELECT count(*) AS count FROM balance_snapshots').get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM position_snapshots').get().count, 1);
  db.close();
});
