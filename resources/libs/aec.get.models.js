const axios = require ("axios");

async function fetchModels(token, projectId) {
  const { data } = await axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/aec/graphql",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      query: `
        query GetElementGroupsByProject($projectId: ID!) {
          elementGroupsByProject(projectId: $projectId) {
                    pagination {
                      cursor
                    }
                    results {
                      name
                      id
                      alternativeIdentifiers {
                        fileUrn
                        fileVersionUrn
                      }
                    }
                  }
                }
            `,
      variables: { projectId },
    },
  });
  return data.data.elementGroupsByProject.results;
}

module.exports = { fetchModels };
