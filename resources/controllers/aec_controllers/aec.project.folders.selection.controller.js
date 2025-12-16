const knex = require('knex')(require('../../../knexfile').development);

const SetSelectedFolder = async (req, res, next) => {
  const { projectId } = req.params;
  const { folderId } = req.body;
  if (!projectId || !folderId) {
    const error = new Error("Missing params");
    error.status = 400;
    error.code = "ValidationError";
    return next(error);
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
    error.code = error.code || "FolderSelectionError";
    return next(error);
  }
};

const GetSelectedFolder = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await knex('plan_folder_selection').where({ project_id: projectId }).first();

    res.json({ success: true, message: "Folder seleccionado obtenido", data: { folderId: result ? result.folder_id : null }, error: null });
  } catch (error) {
    error.code = error.code || "FolderSelectionFetchError";
    return next(error);
  }
};

module.exports = { SetSelectedFolder, GetSelectedFolder };
