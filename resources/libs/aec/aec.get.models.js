const axios = require("axios");

/**
 * Fetches element groups (models) associated with a given AEC project.
 * Handles pagination to retrieve all models.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - AEC project ID.
 * @returns {Promise<Array>} - List of models (element groups) with metadata.
 */
async function fetchModels(token, projectId) {
  let allResults = [];
  let nextCursor = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data } = await axios({
        method: "POST",
        url: "https://developer.api.autodesk.com/aec/graphql",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          query: `
            query GetElementGroupsByProject($projectId: ID!, $cursor: String) {
              elementGroupsByProject(projectId: $projectId, pagination: { cursor: $cursor }) {
                pagination {
                  cursor
                  pageSize
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
          // Aquí pasamos el cursor dinámicamente
          variables: { 
            projectId, 
            cursor: nextCursor 
          },
        },
      });

      // Extraer datos de la respuesta actual
      const responseData = data?.data?.elementGroupsByProject;
      const results = responseData?.results || [];
      
      // Acumular resultados
      allResults = [...allResults, ...results];

      // Actualizar el cursor para la siguiente vuelta
      nextCursor = responseData?.pagination?.cursor;

      // Si no hay cursor, hemos terminado
      if (!nextCursor) {
        hasMore = false;
      }
    }

    console.log(`Total Models fetched: ${allResults.length}`);
    return allResults;

  } catch (error) {
    console.error("Error fetching AEC models:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchModels };