const express = require('express');
const router = express.Router();


const { GetAECProjects } = require('../controllers/aec_controllers/aec.projects.controller');
const { GetAECModels } = require('../controllers/aec_controllers/aec.models.controller');
const { GetModelSheets } = require('../controllers/aec_controllers/aec.plans.controller');
const { GetAECProjectFolders } = require('../controllers/aec_controllers/aec.project.folders');

const { setSelectedModels, getSelectedModels } = require('../controllers/aec_controllers/aec.models.selection.controller');
const { SetSelectedFolder, GetSelectedFolder } = require('../controllers/aec_controllers/aec.project.folders.selection.controller');

router.get ('/graphql-projects', GetAECProjects);
router.get ('/:projectId/graphql-models', GetAECModels);
router.get ('/:projectId/graphql-project-plans', GetModelSheets);
router.get ('/:projectId/graphql-project-folders', GetAECProjectFolders);

router.post ('/:projectId/graphql-models/set-selection', setSelectedModels);
router.get ('/:projectId/graphql-models/get-selection', getSelectedModels);

router.post ('/:projectId/graphql-folders/set-selection', SetSelectedFolder);
router.get ('/:projectId/graphql-folders/get-selection', GetSelectedFolder);

module.exports = router;