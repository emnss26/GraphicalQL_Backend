const { fetchFolderTree } = require("../../../utils/aec_utils/aec.folderTree");

const GetAECProjectFolders = async (req, res) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is required",
      data: null,
      error: "Unauthorized"
    });
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
    console.error("❌ Error fetching folder tree:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve folder tree",
      data: null,
      error: error.message
    });
  }
};

module.exports = { GetAECProjectFolders };