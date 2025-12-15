const axios = require("axios");

const {getRootFolderId} = require ("../../resources/libs/data.management.get.root.folder.js")
const { listFoldersRecursively } = require("../../resources/libs/data.management.get.folders-files.js");

const  GetProjectFilesFolders = async (token, hubId, projectId) => {
  try {
    // Get the root folder ID for the project
    const rootFolderId = await getRootFolderId(token, hubId, projectId);
    //console.log("Root Folder ID:", rootFolderId);

    // List folders recursively starting from the root folder
    const folders = await listFoldersRecursively(token, projectId, rootFolderId);
    //console.log("Folders:", folders);

    return folders;
  } catch (error) {
    console.error("Error fetching project files and folders:", error);
    throw error;
  }
}

module.exports = {
  GetProjectFilesFolders,
};