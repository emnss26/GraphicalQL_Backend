const knexLib = require("knex");
const knexfile = require("../../knexfile");

const env = process.env.NODE_ENV || "development";
const cfg = knexfile[env];

if (!cfg) {
  throw new Error(`No database configuration found for NODE_ENV="${env}"`);
}

const missingDbConfig = Object.entries({
  DB_HOST: cfg.connection?.host,
  DB_USER: cfg.connection?.user,
  DB_NAME: cfg.connection?.database,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingDbConfig.length > 0) {
  throw new Error(
    `Missing required database configuration: ${missingDbConfig.join(", ")}`
  );
}

const knex = knexLib(cfg);
let verificationPromise = null;

knex.verifyConnection = async () => {
  if (!verificationPromise) {
    verificationPromise = knex
      .raw("SELECT 1 AS result")
      .then(() => {
        console.log(`✅ Conexión exitosa a MySQL (${env})`);
        return true;
      })
      .catch((err) => {
        verificationPromise = null;
        throw new Error(
          `No se pudo establecer conexión a MySQL (${env}): ${err.message}`
        );
      });
  }

  return verificationPromise;
};

module.exports = knex;
