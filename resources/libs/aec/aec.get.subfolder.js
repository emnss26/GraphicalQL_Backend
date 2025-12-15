const axios = require("axios");

/**
 * Fetches subfolders within a specified folder in an AEC project.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - AEC project identifier.
 * @param {string} folderId - Parent folder ID to retrieve subfolders from.
 * @returns {Promise<Array>} - List of subfolder objects.
 */
async function fetchSubFolders(token, projectId, folderId) {
  try {
    const { data, errors } = await axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/aec/graphql",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        query: `
          query GetFoldersByFolder($projectId: ID!, $folderId: ID!) {
            foldersByFolder(projectId: $projectId, folderId: $folderId) {
              results {
                id
                name
                objectCount
              }
            }
          }
        `,
        variables: { projectId, folderId }
      },
    }).then(res => res.data);

    if (errors?.length) {
      throw new Error(errors.map(e => e.message).join("\n"));
    }

    return data?.foldersByFolder?.results || [];
  } catch (error) {
    console.error("Error fetching subfolders:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchSubFolders };