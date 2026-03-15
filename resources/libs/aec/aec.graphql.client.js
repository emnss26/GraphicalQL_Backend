const axios = require("axios");

const AEC_GRAPHQL_URL = "https://developer.api.autodesk.com/aec/graphql";
const BYTES_PER_MB = 1024 * 1024;

function extractGraphqlOperationName(query) {
  const text = String(query || "");
  const match = text.match(/\b(?:query|mutation)\s+([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

function getResponseBytes(response) {
  const rawContentLength =
    response?.headers?.["content-length"] ?? response?.headers?.["Content-Length"];

  const contentLength = Number(rawContentLength);
  if (Number.isFinite(contentLength) && contentLength >= 0) {
    return Math.trunc(contentLength);
  }

  try {
    return Buffer.byteLength(JSON.stringify(response?.data ?? {}), "utf8");
  } catch (_err) {
    return 0;
  }
}

function logAecRequestSize(response, operationName = null) {
  const bytes = getResponseBytes(response);
  const mb = (bytes / BYTES_PER_MB).toFixed(4);
  const op = operationName || "GraphQL";
  const status = response?.status ?? "NA";

  console.log(`[AEC MB] ${op} | ${mb} MB | ${bytes} bytes | status ${status}`);
}

async function postAecGraphql(token, query, variables = {}) {
  if (!token) throw new Error("Missing APS access token");

  const operationName = extractGraphqlOperationName(query);
  const payload = { query, variables };
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios.post(AEC_GRAPHQL_URL, payload, config);
    logAecRequestSize(response, operationName);
    return response.data;
  } catch (error) {
    if (error?.response) {
      logAecRequestSize(error.response, operationName);
    }
    throw error;
  }
}

module.exports = {
  AEC_GRAPHQL_URL,
  extractGraphqlOperationName,
  postAecGraphql,
};
