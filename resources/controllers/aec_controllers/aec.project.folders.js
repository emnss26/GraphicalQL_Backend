const axios = require("axios");
const { fetchFolderTree } = require("../../../utils/aec_utils/aec.folderTree");

const GetAECProjectFolders = async (req, res) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({
      data: null,
      error: "Unauthorized",
      message: "Authorization token is required"
    });
  }

  try {
    const folderTree = await fetchFolderTree(token, projectId);

    return res.status(200).json({
      data: { folderTree },
      error: null,
      message: "Folder tree retrieved successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching folder tree:", error);
    return res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve folder tree"
    });
  }
};

module.exports = { GetAECProjectFolders };