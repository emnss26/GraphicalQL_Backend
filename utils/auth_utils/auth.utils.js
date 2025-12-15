const axios = require("axios");

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const APS_CALLBACK_URL = process.env.APS_CALLBACK_URL;


/**
 * Validates required Autodesk Platform Services credentials.
 * Throws an error if any are missing from the environment.
 */
function validateAPSConfig() {
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_CALLBACK_URL) {
    throw new Error("Missing APS_CLIENT_ID, APS_CLIENT_SECRET, or APS_CALLBACK_URL in environment");
  }
}

/**
 * Exchanges a three-legged authorization code for an APS access token.
 * @param {string} code - Authorization code from the OAuth callback
 * @returns {Promise<Object>} - Token response object
 */

const GetAPSThreeLeggedToken = async (code) => {
  validateAPSConfig();

  try {
    const credentials = `${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`;
    const encodedCredentials = Buffer.from(credentials).toString("base64");

    const requestData = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `${APS_CALLBACK_URL}`,
      scope: "data:read data:write data:create account:read viewables:read bucket:read",
    };

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${encodedCredentials}`,
    };

    const { data } = await axios.post(
      "https://developer.api.autodesk.com/authentication/v2/token",
      new URLSearchParams(requestData).toString(),
      { headers }
    );

    //console.log("Three-legged token data:", data);
    
    return data;
  } catch (error) {
    console.error("Error in GetAPSThreeLeggedToken:", error.message);
    throw new Error("Failed to get APS three-legged token");
  }
};

/**
 * Retrieves a two-legged (client credentials) APS token.
 * @returns {Promise<string>} - Access token string
 */

const GetAPSToken = async () => {
    validateAPSConfig();

    try {
        const credentials = `${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`;
        const encodedCredentials = Buffer.from(credentials).toString("base64");

        const requestData = {
            grant_type: "client_credentials",
            scope: "data:read data:create data:write",
        };

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            Authorization: `Basic ${encodedCredentials}`,
        };

        const { data } = await axios.post(
            "https://developer.api.autodesk.com/authentication/v2/token",
            new URLSearchParams(requestData).toString(),
            { headers }
        );
        return data.access_token;
    } catch (error) {
        console.error("Error in GetAPSToken:", error.message);
        throw new Error("Failed to get APS token");
    }
}

module.exports = {
    GetAPSThreeLeggedToken,
    GetAPSToken,
    };
