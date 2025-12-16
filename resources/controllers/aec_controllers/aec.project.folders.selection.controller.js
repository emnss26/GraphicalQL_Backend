const knex = require('knex')(require('../../../knexfile').development);

const SetSelectedFolder = async (req, res) => {
  const { projectId } = req.params;
  const { folderId } = req.body;
  if (!projectId || !folderId) {
    return res.status(400).json({ success: false, message: "Missing params", data: null, error: "ValidationError" });
  }

  try {
    // Borra selección anterior (uno por proyecto)
    await knex('plan_folder_selection').where({ project_id: projectId }).del();
    await knex('plan_folder_selection').insert({
      project_id: projectId,
      folder_id: folderId
    });
    res.status(200).json({ success: true, message: "Folder seleccionado con éxito", data: { folderId }, error: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al seleccionar folder", data: null, error: error.message });
  }
};

const GetSelectedFolder = async (req, res) => {
  const { projectId } = req.params;
  const result = await knex('plan_folder_selection').where({ project_id: projectId }).first();
  
  res.json({ success: true, message: "Folder seleccionado obtenido", data: { folderId: result ? result.folder_id : null }, error: null });
};

module.exports = { SetSelectedFolder, GetSelectedFolder };