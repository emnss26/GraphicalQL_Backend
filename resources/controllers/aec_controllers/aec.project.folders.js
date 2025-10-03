const axios = require("axios");

const { fetchFolderTree } = require("../../../utils/aec_utils/aec.folderTree"); 

const GetAECProjectFolders = async (req, res) => {
  const projectId = req.params.projectId;
  const token = req.cookies["access_token"];

  if (!token) {
    return res.status(401).json({ data: null, error: "No token provided", message: "Authorization token is required" });
  }

  try {
    const folderTree = await fetchFolderTree(token, projectId);
    //console.log(`📂 Folder tree for project ${projectId}:`, folderTree);

    return res.status(200).json({
      data: {
        folderTree: folderTree,
      },
      error: null,
      message: "Folder tree retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching folder tree:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve folder tree",
    });
  }
};

module.exports = {
  GetAECProjectFolders,
};
