const axios = require("axios");

/**
 * Fetch projects from Autodesk Construction Cloud Admin API.
 * Ref: https://aps.autodesk.com/en/docs/acc/v1/reference/http/admin-accounts-accountidprojects-GET/
 * * @param {string} token - 3-legged access token
 * @param {string} hubId - Hub ID (e.g. "b.xxxx-xxxx...")
 * @returns {Promise<Array>} List of active projects formatted for the app.
 */
async function fetchAccProjects(token, hubId) {
  if (!token) throw new Error("Missing APS access token");
  if (!hubId) throw new Error("Missing hubId");

  const accountId = String(hubId).replace(/^b\./, "");

  const projects = [];

  const baseUrl = `https://developer.api.autodesk.com/construction/admin/v1/accounts/${accountId}/projects`;

  const config = {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      "filter[status]": "active", 
      limit: 100,
      offset: 0
    }
  };

  try {
    let hasMore = true;

    while (hasMore) {
      const { data } = await axios.get(baseUrl, config);

      if (Array.isArray(data?.results)) {

        const mapped = data.results.map(p => ({
          id: p.id.startsWith("b.") ? p.id : `b.${p.id}`, 
          type: "projects",
          attributes: {
            name: p.name,
            extension: {
              data: {
                projectType: p.type,
                status: p.status
              }
            }
          }
        }));

        projects.push(...mapped);
      }

      const pagination = data?.pagination;
      if (pagination && pagination.nextUrl) {
    
        config.params.offset += config.params.limit;
        if (projects.length >= (pagination.totalResults || 0)) {
            hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return projects;

  } catch (error) {
    console.error("Error fetching ACC Admin Projects:", error?.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchAccProjects };