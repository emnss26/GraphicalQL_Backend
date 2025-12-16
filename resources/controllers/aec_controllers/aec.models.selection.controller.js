const knex = require('knex')(require('../../../knexfile').development);

const setSelectedModels = async (req, res, next) => {
  const { modelIds } = req.body;
  const { projectId } = req.params;

  try {
    await knex('model_selection').where({ project_id: projectId }).del();

    await knex('model_selection').insert(
      modelIds.map(id => ({ project_id: projectId, model_id: id }))
    );
    res.json({ success: true, message: "Model selection saved", data: null, error: null });
  } catch (error) {
    error.code = error.code || "ModelSelectionSaveError";
    return next(error);
  }
};

const getSelectedModels = async (req, res, next) => {
  const { projectId } = req.params;
  try {
    const rows = await knex('model_selection')
      .where({ project_id: projectId })
      .select('model_id');
    res.json({ success: true, message: "Model selection retrieved", data: { modelIds: rows.map(r => r.model_id) }, error: null });
  } catch (error) {
    error.code = error.code || "ModelSelectionFetchError";
    return next(error);
  }
};

module.exports = { setSelectedModels, getSelectedModels };
