const axios = require("axios");

async function getRootFolderId(token, accountId, projectId) {
  const { data } = await axios.get(
    `https://developer.api.autodesk.com/project/v1/hubs/${accountId}/projects/${projectId}/topFolders`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const top = data.data || [];
  if (!top.length) throw new Error("No top folders found");
  const pf = top.find(
    (f) =>
      f.attributes.displayName === "Project Files" ||
      f.attributes.displayName.toLowerCase() === "archivos de proyecto"
  );
  return (pf || top[0]).id;
}

module.exports = { getRootFolderId };