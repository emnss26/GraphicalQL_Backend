const axios = require("axios");

async function fetchSheets(token, elementGroupId, propertyFilter) {
  const { data } = await axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/aec/graphql',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      query: `
        query GetElementsFromCategory($elementGroupId: ID!, $propertyFilter: String!) {
          elementsByElementGroup(
            elementGroupId: $elementGroupId,
            filter: { query: $propertyFilter }
          ) {
            results {
              id
              name
              properties {
                results {
                  name
                  value
                  definition {
                    units {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        elementGroupId,
        propertyFilter
      },
    },
  });

  return data.data.elementsByElementGroup.results;
}

module.exports = { fetchSheets };