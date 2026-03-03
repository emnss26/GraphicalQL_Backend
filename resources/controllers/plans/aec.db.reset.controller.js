const knex = require("../../../utils/db/knex")
const { ensureTables } = require("../../../utils/db/ensureTables")

const PROJECT_SCOPED_TABLES = [
  "model_selection",
  "plan_folder_selection",
  "plan_alerts",
  "plan_tracking_restrictions",
  "plan_control_comments",
  "user_plans",
]

const ALL_RESET_TABLES = [...PROJECT_SCOPED_TABLES]

async function deleteProjectRowsIfTableExists(tableName, projectId) {
  const exists = await knex.schema.hasTable(tableName)
  if (!exists) return
  await knex(tableName).where({ project_id: projectId }).del()
}

async function deleteAllRowsIfTableExists(tableName) {
  const exists = await knex.schema.hasTable(tableName)
  if (!exists) return
  await knex(tableName).del()
}

/**
 * DELETE /aec/:projectId/reset
 * Clears only the working data for a single project.
 */
const ResetProjectData = async (req, res, next) => {
  const { projectId } = req.params

  if (!projectId) {
    const err = new Error("Project ID is required")
    err.status = 400
    err.code = "ValidationError"
    return next(err)
  }

  try {
    await ensureTables(knex)
    for (const table of PROJECT_SCOPED_TABLES) {
      await deleteProjectRowsIfTableExists(table, projectId)
    }

    return res.json({
      success: true,
      message: `Project ${projectId} cleared`,
      data: null,
      error: null,
    })
  } catch (err) {
    err.code = err.code || "ResetError"
    return next(err)
  }
}

/**
 * DELETE /aec/_all/reset
 * Clears ALL working DB tables (use with care).
 */
const ResetAllData = async (_req, res, next) => {
  try {
    await ensureTables(knex)
    for (const table of ALL_RESET_TABLES) {
      await deleteAllRowsIfTableExists(table)
    }

    return res.json({
      success: true,
      message: "All working DB tables were cleared",
      data: null,
      error: null,
    })
  } catch (err) {
    err.code = err.code || "ResetError"
    return next(err)
  }
}

module.exports = { ResetProjectData, ResetAllData }
