async function ensureTables(knex) {
  // user_plans
  const hasUserPlans = await knex.schema.hasTable("user_plans");
  if (!hasUserPlans) {
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
      t.integer("has_approval_flow").notNullable().defaultTo(0);
      t.string("revision_status").defaultTo("");

      t.date("docs_last_modified");
      t.integer("docs_version_number");
      t.date("latest_review_date");
      t.string("latest_review_status");
      t.date("sheet_updated_at");
      t.string("sheet_version_set");

      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  } else {
    const columnInfo = await knex("user_plans").columnInfo();
    const columnNames = Object.keys(columnInfo);

    if (!columnNames.includes("has_approval_flow")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.integer("has_approval_flow").notNullable().defaultTo(0);
      });
    }

    if (!columnNames.includes("revision_status")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.string("revision_status").defaultTo("");
      });
    }

    if (!columnNames.includes("docs_last_modified")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.date("docs_last_modified");
      });
    }

    if (!columnNames.includes("docs_version_number")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.integer("docs_version_number");
      });
    }

    if (!columnNames.includes("latest_review_date")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.date("latest_review_date");
      });
    }

    if (!columnNames.includes("latest_review_status")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.string("latest_review_status");
      });
    }

    if (!columnNames.includes("sheet_updated_at")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.date("sheet_updated_at");
      });
    }

    if (!columnNames.includes("sheet_version_set")) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.string("sheet_version_set");
      });
    }
  }

  // model_selection
  const hasModelSelection = await knex.schema.hasTable("model_selection");
  if (!hasModelSelection) {
    await knex.schema.createTable("model_selection", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().index();
      t.string("model_id").notNullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.unique(["project_id", "model_id"]);
    });
  }

  // plan_folder_selection
  const hasPlanFolderSelection = await knex.schema.hasTable("plan_folder_selection");
  if (!hasPlanFolderSelection) {
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
