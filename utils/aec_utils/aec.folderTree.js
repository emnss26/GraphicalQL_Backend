const { fetchTopFoldersGraphql } = require("../../resources/libs/aec/aec.get.topfolder.js");
const { fetchSubFolders } = require("../../resources/libs/aec/aec.get.subfolder.js");

/**
 * Recursively builds a folder tree starting from top-level folders in a project.
 * Each folder may contain children retrieved via the Autodesk GraphQL API.
 *
 * @param {string} token - APS access token
 * @param {string} projectId - The project ID (URN or bare GUID)
 * @returns {Promise<Array>} - A nested folder tree structure
 */
async function fetchFolderTree(token, projectId) {
  const topFolders = await fetchTopFoldersGraphql(token, projectId);

  async function buildTree(folder) {
    const subFolders = await fetchSubFolders(token, projectId, folder.id);
    return {
      ...folder,
      children: await Promise.all(subFolders.map(buildTree)) // Recursively build children
    };
  }

  return await Promise.all(topFolders.map(buildTree));
}

module.exports = { fetchFolderTree };