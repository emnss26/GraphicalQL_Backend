const axios = require("axios");

async function fetchProjects(token, hubId) {
  const { data } = await axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/aec/graphql",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      query: `
        query GetProjects($hubId: ID!) {
            projects(hubId: $hubId) {
              pagination {
                cursor
              }
              results {
                id
                name
                alternativeIdentifiers {
                  dataManagementAPIProjectId
                }
              }
            }
          }
        `,
      variables: { hubId },
    },
  });
  return data.data.projects.results;
}

module.exports = { fetchProjects };
