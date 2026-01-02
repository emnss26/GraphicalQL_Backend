const { fetchTopFoldersGraphql } = require("../../resources/libs/aec/aec.get.topfolder.js")
const { fetchSubFolders } = require("../../resources/libs/aec/aec.get.subfolder.js")

/**
 * Builds a nested folder tree for an AEC project (GraphQL).
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - AEC project ID (URN or GUID).
 * @returns {Promise<Array>} Folder tree.
 */
async function fetchFolderTree(token, projectId) {
  const topFolders = await fetchTopFoldersGraphql(token, projectId)

  const buildTree = async (folder) => {
    const children = await fetchSubFolders(token, projectId, folder.id)
    return {
      ...folder,
      children: await Promise.all(children.map(buildTree)),
    }
  }

  return Promise.all(topFolders.map(buildTree))
}

module.exports = { fetchFolderTree }
