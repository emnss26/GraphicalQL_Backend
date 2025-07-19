const axios = require("axios");

async function fetchSubFolders(token, projectId, folderId) {
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
  }).then(r => r.data);

  if (errors && errors.length) {
    throw new Error(errors.map(e => e.message).join("\n"));
  }

  return data.foldersByFolder.results;
}

module.exports = { fetchSubFolders };