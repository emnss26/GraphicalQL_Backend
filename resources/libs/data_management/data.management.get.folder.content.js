const axios = require("axios");

/**
 * Recursively fetches ALL files from a folder and its subfolders, handling pagination.
 */
async function fetchFolderContents(token, projectId, folderId) {
  try {
    let allItemsInThisFolder = [];
    // URL inicial
    let nextUrl = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents?include=versions`;

    // 1. Paginación Horizontal: Obtener todo el contenido de ESTA carpeta
    while (nextUrl) {
      const { data: response } = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const items = response.data || [];
      allItemsInThisFolder = allItemsInThisFolder.concat(items);

      // La API REST devuelve 'links.next.href' si hay más páginas
      nextUrl = response.links?.next?.href || null;
    }

    // 2. Procesamiento y Recursión Vertical (Subcarpetas)
    let allFiles = [];

    for (const item of allItemsInThisFolder) {
      if (item.type === "folders") {
        // Llamada recursiva para entrar en la subcarpeta
        const subFiles = await fetchFolderContents(token, projectId, item.id);
        allFiles = allFiles.concat(subFiles);
      } else if (item.type === "items") {
        allFiles.push(item);
      }
    }

    return allFiles;

  } catch (error) {
    console.error(`Error processing folder ${folderId}:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchFolderContents };