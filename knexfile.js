const path = require("path");
const dotenv = require("dotenv");

const ENV = process.env.NODE_ENV || "development";
const ENV_FILE = ENV === "production" ? ".env.production" : ".env";

dotenv.config({
  path: path.resolve(__dirname, ENV_FILE),
});

const parsePort = (value) => {
  const parsed = Number.parseInt(value || "3306", 10);
  return Number.isFinite(parsed) ? parsed : 3306;
};

const buildConnection = () => ({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  port: parsePort(process.env.DB_PORT),
});

const buildConfig = () => ({
  client: process.env.DB_CLIENT || "mysql2",
  connection: buildConnection(),
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: "knex_migrations",
  },
});

module.exports = {
  development: buildConfig(),
  production: buildConfig(),
};
