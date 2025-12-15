require('dotenv').config();

const ENV = process.env.NODE_ENV || 'development';

// Ensure required environment variables are defined
const required = ['APS_CLIENT_ID', 'APS_CLIENT_SECRET', 'APS_CALLBACK_URL'];
required.forEach((name) => {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
});

const config = {
  env: ENV,
  port: process.env.PORT || 3000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  aps: {
    clientId: process.env.APS_CLIENT_ID,
    clientSecret: process.env.APS_CLIENT_SECRET,
    callbackUrl: process.env.APS_CALLBACK_URL,
    baseUrl: process.env.APS_BASE_URL || 'https://developer.api.autodesk.com',
  },
  database: {
    client: 'sqlite3',
    connection: {
      filename: './dev.sqlite3',
    },
  },
};

module.exports = config;