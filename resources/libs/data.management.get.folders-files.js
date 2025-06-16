const axios = require('axios');

async function listFoldersRecursively(token, projectId, folderId) {
  const { data } = await axios.get(
    `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const items = data.data || [];
  const folders = items.filter((i) => i.type === "folders");

  const result = folders.map((f) => ({
    id: f.id,
    name: f.attributes.displayName,
  }));

  for (const f of folders) {
    const sub = await listFoldersRecursively(token, projectId, f.id);
    result.push(...sub);
  }

  return result;
}

module.exports = {
    listFoldersRecursively, 
}