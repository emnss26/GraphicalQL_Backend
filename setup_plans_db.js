const knex = require('knex')(require('./knexfile').development);

knex.schema.hasTable('plan_folder_selection').then(exists => {
  if (!exists) {
    return knex.schema.createTable('plan_folder_selection', table => {
      table.increments('id').primary();
      table.string('project_id');
      table.string('folder_id');
      table.timestamp('selected_at').defaultTo(knex.fn.now());
    });
  }
}).then(() => {
  console.log('Tabla plan_folder_selection creada o ya existe.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});