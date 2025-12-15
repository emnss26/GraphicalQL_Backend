const axios = require("axios");

/**
 * Recursively fetches all files from a folder and its subfolders.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - ACC project ID.
 * @param {string} folderId - Folder ID to start traversal from.
 * @returns {Promise<Array>} - List of all file items found.
 */
async function fetchFolderContents(token, projectId, folderId) {
  try {
    const { data: response } = await axios.get(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents?include=versions`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const items = response.data || [];
    let allFiles = [];

    for (const item of items) {
      if (item.type === "folders") {
        // Recursively process subfolder contents
        const subFiles = await fetchFolderContents(token, projectId, item.id);
        allFiles = allFiles.concat(subFiles);
      } else if (item.type === "items") {
        allFiles.push(item);
      }
    }

    return allFiles;
  } catch (error) {
    console.error("Error fetching folder contents:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchFolderContents };