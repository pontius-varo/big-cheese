import axios, { isCancel, AxiosError } from 'axios';
import { createHmac } from 'node:crypto';
import { buildSignatureParts, assembleBaseSignatureString, createInitHeaders } from './aux.js';
// Should be ENV variable..
// SECRET is issued by webull platform
// const secret = popperplantpowder343EU7;
// const sessionhash = createHmac('SHA1', secret);

// continue on https://developer.webull.com/apis/docs/authentication/signature
// aimed endpoint https://developer.webull.com/apis/docs/reference/broker-market-data-api/create-client-token

// appKey and secret should be available at the ENV level as globals....
class HeaderCreator {
  constructor(appKey, secret, host) {
    this.appKey = appKey;
    this.secret = secret;
    this.host = host;
  }

  createNewHeaders() {
    return createInitHeaders(this.appKey, this.host);
  }

  createRequestSignature(body, targetPath, queryObj, initHeaders) {
    const [queryArr, headersArr] = buildSignatureParts(this.appKey, queryObj, initHeaders);
    const baseSignature = assembleBaseSignatureString(targetPath, queryArr, headersArr, body);
    return createHmac('SHA1', `${this.secret}&`).update(baseSignature, "utf8").digest("base64");
  }

  // Kind of redundant under the hood with aux, but this works for now
  createTrueHeaders(initHeaders, signature) {
      let { timeStamp, signatureNonce } = initHeaders;
      return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-app-key": this.appKey,
        "x-timestamp": timeStamp,
        "x-signature-algorithm": "HMAC-SHA1",
        "x-signature-version": "1.0",
        "x-signature-nonce": signatureNonce,
        "x-version": "v2",
        "x-signature": signature,
      }
  }

  createRequestHeaders(body, targetPath, queryObj) {
    const initHeaders = this.createNewHeaders();
    const signature = this.createRequestSignature(body, targetPath, queryObj, initHeaders);
    const trueHeaders = this.createTrueHeaders(initHeaders, signature);

    return trueHeaders;
  }
}

export class WebullCustomSDK {
  constructor(appKey, secretKey, targetUrl) {
    this.appKey = appKey;
    this.secretKey = secretKey;
    this.targetUrl = targetUrl?.replace(/\/$/, "");

    // Instance of header creator, to be used for all requests...
    const host = this.targetUrl
      ? new URL(this.targetUrl.includes("://") ? this.targetUrl : `https://${this.targetUrl}`).host
      : undefined;
    this.headerCreator = new HeaderCreator(this.appKey, this.secretKey, host);
  }

  async getAccountList() {
    const targetPath = "/trading/accounts/list";
    const headers = this.headerCreator.createRequestHeaders(undefined, targetPath, {});
    const baseUrl = this.targetUrl.includes("://")
      ? this.targetUrl
      : `https://${this.targetUrl}`;

    const response = await axios.get(`${baseUrl}${targetPath}`, { headers });
    return response.data;
  }

  async getClientToken(body) {
    // Body should be { "client_user_id": clientUserId }
    const data = JSON.stringify(body);

    const headers = this.headerCreator.createRequestHeaders(body, "", {});

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: this.targetUrl,
      headers: headers,
      data: data
    }

    console.log("getClientToken config");
    console.log(config);

    try {
      let response = await axios.request(config);
      /*
        Should return an object like the following

      {
        "access_token": "TH.19b68a108ad-51627ef292044cc3b39c37800523d803",
        "expires_at": 1766987799637,
        "refresh_token": "19b68a108ad-4013b3daec584bc2b078ae1902ce0986",
        "refresh_expires_at": 1767004942637
      }

      access_token is used for market data api operations
      and expires in 2hrs

      refresh token expires in 15 days...

      see https://developer.webull.com/apis/docs/reference/broker-market-data-api/create-client-token
      */

      console.log(response);

      return response;
    } catch (error) {
      console.error("Error when attempting to fetch client token", error);
    }
  }
}

