const path = require("path");
const dotenv = require("dotenv");

const ENV = process.env.NODE_ENV || "development";
const ENV_FILE = ENV === "production" ? ".env.production" : ".env";

dotenv.config({
  path: path.resolve(__dirname, ENV_FILE),
});

const REQUIRED_ENV_VARS = ["APS_CLIENT_ID", "APS_CLIENT_SECRET", "APS_CALLBACK_URL"];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config = {
  env: ENV,
  port: Number(process.env.PORT || 3000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  aps: {
    clientId: process.env.APS_CLIENT_ID,
    clientSecret: process.env.APS_CLIENT_SECRET,
    callbackUrl: process.env.APS_CALLBACK_URL,
    baseUrl: process.env.APS_BASE_URL || "https://developer.api.autodesk.com",
  },
  database: {
    client: "sqlite3",
    connection: {
      filename: process.env.SQLITE_PATH || "C:/Data/ABITAT/db/prod.sqlite3",
    },
  },
};

module.exports = config;