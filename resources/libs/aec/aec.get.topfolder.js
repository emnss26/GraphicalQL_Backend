const axios = require("axios");

async function fetchTopFoldersGraphql(token, projectId) {
  const resp = await axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/aec/graphql",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      
    },
    data: {
      query: `
        query GetFoldersByProject($projectId: ID!) {
          foldersByProject(projectId: $projectId) {
            results {
              id
              name
              objectCount
            }
          }
        }
      `,
      variables: { projectId }
    },
  });

  return resp.data.data.foldersByProject.results;
}

module.exports = { fetchTopFoldersGraphql };
