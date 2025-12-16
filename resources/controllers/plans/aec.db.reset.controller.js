const knex = require('knex')(require('../../../knexfile').development);

// DELETE /aec/:projectId/reset  -> limpia SOLO ese proyecto
const ResetProjectData = async (req, res) => {
  const { projectId } = req.params;
  try {
    await knex('model_selection').where({ project_id: projectId }).del();
    await knex('plan_folder_selection').where({ project_id: projectId }).del();
    await knex('user_plans').where({ project_id: projectId }).del();
    res.json({ success: true, message: `Proyecto ${projectId} limpiado`, data: null, error: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'No se pudo limpiar el proyecto', data: null, error: e.message || 'ResetError' });
  }
};

// DELETE /aec/_all/reset -> borra TODO (usa con cuidado)
const ResetAllData = async (_req, res) => {
  try {
    await knex('model_selection').del();
    await knex('plan_folder_selection').del();
    await knex('user_plans').del();
    res.json({ success: true, message: 'Toda la BD de trabajo fue limpiada', data: null, error: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'No se pudo limpiar todo', data: null, error: e.message || 'ResetError' });
  }
};

module.exports = { ResetProjectData, ResetAllData };