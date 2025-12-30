const axios = require("axios");

async function fetchAccProjects(token, accountId) {
  if (!token) throw new Error("No token provided");
  
  let allProjects = [];
  // URL base para proyectos
  let nextUrl = `https://developer.api.autodesk.com/project/v1/hubs/${accountId}/projects`;

  try {
    while (nextUrl) {
      const { data } = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      allProjects = [...allProjects, ...(data.data || [])];

      // Verificar si existe siguiente página en los links
      nextUrl = data.links?.next?.href || null;
    }

    return allProjects;
  } catch (error) {
    console.error("Error fetching ACC projects:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchAccProjects };