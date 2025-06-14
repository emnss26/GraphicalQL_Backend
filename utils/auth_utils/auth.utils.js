const express = require("express");
const axios = require("axios");

const router = express.Router();

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const APS_BASE_URL = process.env.APS_BASE_URL;

const GetAPSThreeLeggedToken = async (code) => {
  if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_BASE_URL) {
    throw new Error(
      "APS_CLIENT_ID, APS_CLIENT_SECRET, or APS_BASE_URL is not defined"
    );
  }

  try {
    const credentials = `${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`;
    const encodedCredentials = Buffer.from(credentials).toString("base64");

    const requestData = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `${APS_BASE_URL}`,
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

    console.log("APS Three-Legged Token:", data.access_token);
    
    return data.access_token;

  } catch (error) {
    console.error("Error in GetAPSThreeLeggedToken:", error);
    throw new Error("Failed to get APS three-legged token");
  }
};

const GetAPSToken = async () => {
    if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_BASE_URL) {
        throw new Error(
            "APS_CLIENT_ID, APS_CLIENT_SECRET, or APS_BASE_URL is not defined"
        );
    }

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
        console.error("Error in GetAPSToken:", error);
        throw new Error("Failed to get APS token");
    }
}

module.exports = {
    GetAPSThreeLeggedToken,
    GetAPSToken,
    };
