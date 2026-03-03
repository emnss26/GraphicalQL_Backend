const knexLib = require("knex");
const knexfile = require("../../knexfile");

const env = process.env.NODE_ENV || "development";
const cfg = knexfile[env];


const knex = knexLib(cfg);


knex.raw('SELECT 1+1 as result')
  .then(() => {
    console.log(`✅ Conexión exitosa a MySQL (${env})`);
  })
  .catch((err) => {
    console.error("❌ Error fatal conectando a la base de datos:", err);

  });

module.exports = knex;