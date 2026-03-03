exports.up = async function (knex) {
  const hasUserPlans = await knex.schema.hasTable("user_plans");
  if (hasUserPlans) {
    const hasSpecialty = await knex.schema.hasColumn("user_plans", "specialty");
    if (!hasSpecialty) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.string("specialty").defaultTo("");
      });
    }
  }

  const hasTracking = await knex.schema.hasTable("plan_tracking_restrictions");
  if (!hasTracking) {
    await knex.schema.createTable("plan_tracking_restrictions", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().index();
      t.date("week_key").notNullable();
      t.integer("tracking_week").nullable();
      t.date("week_end").nullable();
      t.text("restriction").defaultTo("");
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());

      t.unique(["project_id", "week_key"]);
    });
  }

  const hasControl = await knex.schema.hasTable("plan_control_comments");
  if (!hasControl) {
    await knex.schema.createTable("plan_control_comments", (t) => {
      t.increments("id").primary();
      t.string("project_id").notNullable().index();
      t.integer("plan_id").nullable().index();
      t.string("plan_number").nullable();
      t.string("plan_name").notNullable().defaultTo("");
      t.text("comment").defaultTo("");
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  const hasControl = await knex.schema.hasTable("plan_control_comments");
  if (hasControl) {
    await knex.schema.dropTable("plan_control_comments");
  }

  const hasTracking = await knex.schema.hasTable("plan_tracking_restrictions");
  if (hasTracking) {
    await knex.schema.dropTable("plan_tracking_restrictions");
  }

  const hasUserPlans = await knex.schema.hasTable("user_plans");
  if (hasUserPlans) {
    const hasSpecialty = await knex.schema.hasColumn("user_plans", "specialty");
    if (hasSpecialty) {
      await knex.schema.alterTable("user_plans", (t) => {
        t.dropColumn("specialty");
      });
    }
  }
};
