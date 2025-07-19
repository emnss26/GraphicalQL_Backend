const { fetchTopFoldersGraphql } = require("../../resources/libs/aec/aec.get.topfolder.js" );
const { fetchSubFolders } = require("../../resources/libs/aec/aec.get.subfolder.js");


async function fetchFolderTree(token, projectId) {
  const topFolders = await fetchTopFoldersGraphql(token, projectId);
  async function buildTree(folder) {
    const subFolders = await fetchSubFolders(token, projectId, folder.id);
    return {
      ...folder,
      children: await Promise.all(subFolders.map(buildTree))
    };
  }
  
  return await Promise.all(topFolders.map(buildTree));
  
}

module.exports = { fetchFolderTree };