const axios = require("axios");

async function fetchFolderContents(token, projectId, folderId) {
  const { data } = await axios.get(
    `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents?include=versions`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data.data;
}

module.exports = { fetchFolderContents };