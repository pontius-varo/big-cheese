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

  let firstAccountId = "";


  try {
    const accounts = await webbullClient.getAccountList();
    console.log("Webull accounts:");
    // console.dir(accounts, { depth: null });
    console.log(`Collected ${accounts.length} accounts!`);
    firstAccountId = accounts[1].account_id
    console.log(`Collecting the following accountId: ${firstAccountId}`);

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

  console.log(`Grabbing account ${firstAccountId} assets...`);

  try {
    const assets = await webbullClient.getAccountAssets(firstAccountId);
    console.log("GOT ASSETS:");
    console.dir(assets, { depth: null });
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
