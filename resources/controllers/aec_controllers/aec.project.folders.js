const { fetchFolderTree } = require("../../../utils/aec_utils/aec.folderTree");

const GetAECProjectFolders = async (req, res, next) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    const error = new Error("Authorization token is required");
    error.status = 401;
    error.code = "Unauthorized";
    return next(error);
  }

  try {
    const folderTree = await fetchFolderTree(token, projectId);

    return res.status(200).json({
      success: true,
      message: "Folder tree retrieved successfully",
      data: { folderTree },
      error: null
    });
  } catch (error) {
    error.code = error.code || "AECFolderTreeFetchFailed";
    return next(error);
  }
};

module.exports = { GetAECProjectFolders };
