import { randomBytes, createHash } from 'node:crypto';

/* Private functions */
function createHeadersArr(initHeaders) {
 return [
    `host=${initHeaders.host}`,
    `x-app-key=${initHeaders.appKey}`,
    `x-timestamp=${initHeaders.timeStamp}`,
    `x-signature-algorithm=${initHeaders.signatureAlgorithm}`,
    `x-signature-version=${initHeaders.signatureVersion}`,
    `x-signature-nonce=${initHeaders.signatureNonce}`
  ]
}

function createQueryArr(queryObj) {
    // Get an array of {"a1": "webull", etc}
    let paramsArr = []

    for (const key in queryObj) {
        paramsArr.push(`${key}=${queryObj[key]}`)
    }

    return paramsArr;
}

// Assemble Str1 from queryParams and headers
function createStr1(queryParams, headers) {
    // join queryParams and headers arrays, sort alphabetically, join with '&'
    let str1 = [
        ...queryParams,
        ...headers,
    ].sort((a, b) => a.localeCompare(b)).join("&");
    return str1;
}

// Assemble Str2 from Body
function createStr2(jsonBody) {
    if (jsonBody === undefined || jsonBody === null) {
        return "";
    }

    const bodyStr = JSON.stringify(jsonBody);
    return createHash("md5").update(bodyStr).digest("hex").toUpperCase();
}

// Assemble Str3 from target path + str1 and str2, then return encoded
// str3 = path + & + str1 + & + st2
function createStr3(targetPath, str1, str2) {
    let str3Raw = str2 ? `${targetPath}&${str1}&${str2}` : `${targetPath}&${str1}`;
    return encodeURIComponent(str3Raw);
}

/* Public Functions */
export function createInitHeaders(appKey, host) {
  const date = new Date();
  const timeStamp = date.toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = randomBytes(16).toString('hex');

  console.log(`Geneated timestamp: ${timeStamp}`);
  console.log(`Generated nonce: ${nonce}`);

  return {
    appKey: appKey,
    host: host,
    timeStamp: timeStamp,
    signatureAlgorithm: "HMAC-SHA1",
    signatureVersion: "1.0",
    signatureNonce: nonce,
    version: "v2"
  }
}

export function assembleBaseSignatureString(targetPath, queryParams, headers, body) {
    let str1 = createStr1(queryParams, headers);
    let str2 = createStr2(body);
    return createStr3(targetPath, str1, str2);
}

export function buildSignatureParts(appKey, queryObj, initHeaders) {
    const queryArr = createQueryArr(queryObj);
    const headersArr = createHeadersArr(initHeaders);

    return [
        queryArr,
        headersArr
    ]
}
