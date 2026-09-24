import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase, main as startWebullWorker } from './webull_worker.js';

const DEFAULT_PORT = 5002;
const DEFAULT_DATABASE_PATH = path.resolve('data/big_cheese.sqlite');

export async function main() {
  const databasePath = path.resolve(process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH);
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  initializeDatabase(db);

  const port = Number.parseInt(process.env.PORT ?? DEFAULT_PORT, 10);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    db.close();
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const app = createApp(db);
  const server = app.listen(port, () => console.log(`Listening on port ${port}`));

  startWebullWorker().catch((error) => {
    console.error('Unable to start Webull worker', error);
    server.close(() => {
      db.close();
      process.exitCode = 1;
    });
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => db.close());
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.on('unhandledRejection', (error) => {
    console.error(error);
    process.exitCode = 1;
    shutdown();
  });

  return { app, server, db };
}

const isEntryPoint = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) await main();
