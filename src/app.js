import express from 'express';
import { config } from 'dotenv';

const app = express();
const port = 5002;

// Middleware goes here
// What is middleware anyway?

// Routes go here
// Routes should feed the front-end

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// Catch process failures
process.on("unhandledRejection", async (err) => {
  console.error(err);
  server.close(async () => {
    // Kill process gracefully
    process.exit(1);
  });
});
