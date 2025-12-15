const axios = require("axios");

/**
 * Retrieves the root folder ID ("Project Files") for a given project.
 *
 * @param {string} token - APS access token.
 * @param {string} accountId - Autodesk account (hub) ID.
 * @param {string} projectId - Autodesk project ID.
 * @returns {Promise<string>} - Root folder ID.
 * @throws {Error} - If no top folders are found.
 */
async function getRootFolderId(token, accountId, projectId) {
  const { data } = await axios.get(
    `https://developer.api.autodesk.com/project/v1/hubs/${accountId}/projects/${projectId}/topFolders`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const topFolders = data.data || [];
  if (!topFolders.length) throw new Error("No top folders found");

  const rootFolder = topFolders.find(
    (folder) =>
      folder.attributes.displayName === "Project Files" ||
      folder.attributes.displayName.toLowerCase() === "archivos de proyecto"
  );

  return (rootFolder || topFolders[0]).id;
}

module.exports = { getRootFolderId };