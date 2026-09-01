import { WebullCustomSDK } from './src/custom_sdk/driver.js';
import 'dotenv/config';

const appKey = process.env.APP_KEY;
const secret = process.env.SECRET;
const targetURL = process.env.TARGET_URL;

const webbullClient = new WebullCustomSDK(appKey, secret, targetURL);

async function test() {
  if (!appKey || !secret || !targetURL) {
    throw new Error("APP_KEY, SECRET, and TARGET_URL must be defined in .env");
  }

  try {
    const accounts = await webbullClient.getAccountList();
    console.log("Webull accounts:");
    console.dir(accounts, { depth: null });
  } catch (error) {
    if (error.response) {
      console.error("Webull account-list request failed", {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error("Unable to call Webull account-list endpoint:", error.message);
    }

    process.exitCode = 1;
  }
}

await test();
