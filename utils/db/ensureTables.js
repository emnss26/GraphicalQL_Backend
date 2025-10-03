async function ensureTables(knex) {
  // user_plans
  if (!(await knex.schema.hasTable("user_plans"))) {
    await knex.schema.createTable("user_plans", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().index();
      t.string("name").defaultTo("");
      t.string("number").nullable().index();

      t.date("planned_gen_date");
      t.date("actual_gen_date");
      t.date("planned_review_date");
      t.date("actual_review_date");
      t.date("planned_issue_date");
      t.date("actual_issue_date");

      t.string("current_revision").defaultTo("");
      t.date("current_revision_date");
      t.string("status").defaultTo("");

      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }

  // model_selection (selección de modelos por proyecto)
  if (!(await knex.schema.hasTable("model_selection"))) {
    await knex.schema.createTable("model_selection", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().index();
      t.string("model_id").notNullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.unique(["project_id", "model_id"]);
    });
  }

  // plan_folder_selection (un folder de publicación por proyecto)
  if (!(await knex.schema.hasTable("plan_folder_selection"))) {
    await knex.schema.createTable("plan_folder_selection", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().unique();
      t.string("folder_id").notNullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
}

module.exports = { ensureTables };