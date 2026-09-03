import { WebullCustomClient } from './custom_sdk/driver.js';
import 'dotenv/config';

/*
    This file is used for MINING data from the webull API. It SHOULD collect account data and save it to a database, either postgres or sqlite.

    NOTE: You know, this could be a python spark ETL program...
*/

// Both appKeys and secrets should have the same arr length..
const appKeys = process.env.APP_KEYS.split(",");
const secrets = process.env.SECRETS.split(",");
const targetURL = process.env.TARGET_URL;
/*
const webullClient = new WebullCustomClient()*/

function pushAccountData() {

}

// organize account data for DB writes
// See https://developer.webull.com/apis/docs/reference/assets for
// both assets and positions data
// this function should TRANSFORM the data into a db friendly format
function organizeAccountData(accountData) {

}

// Get account data from webull
async function mineAccountData(appKey, secret) {
    let webullClientInst = new WebullCustomClient(appKey, secret);

    let accountData = {
        primaryId: appKey,
        subAccounts: []
    };

    // Collect all sub account
    const subAccounts = await webullClient.getAccountList();

    // Get subAccount assets and positions
    // NOTE: Needs error handling
    for (const subAccount of subAccounts) {
        let subAccountId = subAccount["account_id"];

        let assets = await webullClient.getAccountAssets(subAccountId);

        let positions = await webullClient.getAccountPositions(subAccountId);

        const subAccountData = {
            subAccountId,
            assets,
            positions
        };

        accountData.subAccounts.push(subAccountData);
    }

    return accountData;
}

async function main() {

    if appKeys.length != secrets.length {
        // This could be an error instead...maybe in v2
        console.warn("appKeys and secrets array do not have same length. Stopping now");
        process.exitCode(1);
    }

    let accountData = [];

    for (let i = 0; i < appKeys.length; i++) {
        let data = await mineAccountData(appKey[i], secret[i]);
        accountData.push(data);
    }
}
