const knex = require('knex')(require('./knexfile').development);

knex.schema.hasTable('model_selection').then(exists => {
  if (!exists) {
    return knex.schema.createTable('model_selection', table => {
      table.increments('id').primary();
      table.string('project_id');
      table.string('model_id');
      table.timestamp('selected_at').defaultTo(knex.fn.now());
    });
  }
}).then(() => {
  console.log('Tabla creada o ya existe.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});