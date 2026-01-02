const knex = require("knex")(require("../../../knexfile").development)

/**
 * Stores the selected AEC model IDs for a given project.
 * Behavior: replaces any previous selection (delete + insert).
 */
const setSelectedModels = async (req, res, next) => {
  const { projectId } = req.params
  const { modelIds } = req.body

  try {
    // Keep behavior: wipe previous selection and insert the new one.
    await knex("model_selection").where({ project_id: projectId }).del()

    const ids = Array.isArray(modelIds) ? modelIds : []
    if (ids.length > 0) {
      await knex("model_selection").insert(
        ids.map((id) => ({ project_id: projectId, model_id: id }))
      )
    }

    return res.json({
      success: true,
      message: "Model selection saved",
      data: null,
      error: null,
    })
  } catch (err) {
    err.code = err.code || "ModelSelectionSaveError"
    return next(err)
  }
}

/**
 * Returns the selected AEC model IDs for a given project.
 */
const getSelectedModels = async (req, res, next) => {
  const { projectId } = req.params

  try {
    const rows = await knex("model_selection")
      .where({ project_id: projectId })
      .select("model_id")

    return res.json({
      success: true,
      message: "Model selection retrieved",
      data: { modelIds: rows.map((r) => r.model_id) },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "ModelSelectionFetchError"
    return next(err)
  }
}

module.exports = { setSelectedModels, getSelectedModels }
