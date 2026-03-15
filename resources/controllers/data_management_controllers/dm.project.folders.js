const { fetchFolderTree } = require("../../../utils/dm/dm.folderTree")

const GetDMProjectFolders = async (req, res, next) => {
  const { projectId } = req.params; 
  const { dmId } = req.query;       
  const token = req.cookies?.access_token;

  if (!token) {
    const err = new Error("Authorization token is required");
    err.status = 401;
    return next(err);
  }

  try {

    const targetId = dmId ;

    const folderTree = await fetchFolderTree(token, targetId);

    return res.status(200).json({
      success: true,
      message: "Folder tree retrieved successfully (REST)",
      data: { folderTree },
      error: null,
    })
  } catch (err) {
    console.error("Tree Fetch Error:", err);
    err.code = err.code || "FolderTreeError";
    return next(err);
  }
}

module.exports = { GetDMProjectFolders }