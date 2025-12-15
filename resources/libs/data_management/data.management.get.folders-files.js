const axios = require('axios');

/**
 * Recursively lists all folders starting from a given folderId within a project.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - ACC project ID.
 * @param {string} folderId - Root folder ID to start the recursion.
 * @returns {Promise<Array<{ id: string, name: string }>>} - List of folder objects with id and name.
 */
async function listFoldersRecursively(token, projectId, folderId) {
  try {
    const { data } = await axios.get(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const items = data.data || [];
    const folders = items.filter((item) => item.type === "folders");

    const result = folders.map((folder) => ({
      id: folder.id,
      name: folder.attributes.displayName
    }));

    for (const folder of folders) {
      const subFolders = await listFoldersRecursively(token, projectId, folder.id);
      result.push(...subFolders);
    }

    return result;
  } catch (error) {
    console.error("Error listing folders recursively:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  listFoldersRecursively,
};