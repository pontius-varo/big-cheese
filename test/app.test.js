import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/app.js';
import { initializeDatabase, organizeAccountData, pushAccountData } from '../src/webull_worker.js';

let db;
let server;
let baseUrl;

before(async () => {
  db = new DatabaseSync(':memory:');
  initializeDatabase(db);
  pushAccountData(db, organizeAccountData({
    sourceId: 'source-1',
    subAccounts: [
      {
        subAccount: { account_id: 'account-1', account_type: 'CASH' },
        assets: { currency: 'USD', total_asset: '100' },
        positions: [
          { symbol: 'ABC', quantity: '2', market_value: '60' },
          { symbol: 'XYZ', quantity: '1', market_value: '40' },
        ],
      },
      {
        subAccount: { account_id: 'account-2', account_type: 'CASH' },
        assets: { currency: 'USD', total_asset: '50' },
        positions: [],
      },
    ],
  }, '2026-09-23T12:05:00.000Z'));

  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (
    error ? reject(error) : resolve()
  )));
  db.close();
});

test('GET /health reports database availability', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /api/summary returns total and individual account values', async () => {
  const response = await fetch(`${baseUrl}/api/summary`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.accountCount, 2);
  assert.equal(body.totalsByCurrency.USD, 150);
  assert.equal(body.accounts.length, 2);
});

test('GET /api/accounts/:accountId/composition calculates weights', async () => {
  const response = await fetch(`${baseUrl}/api/accounts/account-1/composition`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.positions[0].symbol, 'ABC');
  assert.equal(body.positions[0].weight, 0.6);
  assert.equal(body.positions[1].weight, 0.4);
});

test('GET /api/history returns bucketed portfolio totals', async () => {
  const response = await fetch(`${baseUrl}/api/history?bucket=hour`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.points.length, 1);
  assert.equal(body.points[0].totalValue, 150);
});

test('unknown routes and invalid history options return JSON errors', async () => {
  const invalidHistory = await fetch(`${baseUrl}/api/history?bucket=week`);
  assert.equal(invalidHistory.status, 400);
  assert.match((await invalidHistory.json()).error, /bucket/);

  const missing = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Route not found' });
});
