const express = require('express');
const router = express.Router();
const checkSession = require('../../middlewares/checkSession');

const {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
} = require('../controllers/plans/aec.project.plans.controller');

const {
  ResetProjectData,
  ResetAllData,
} = require('../controllers/plans/aec.db.reset.controller');

// Session check middleware
router.use(checkSession);

// Plans operations
router.get('/:projectId/plans', listPlans);
router.post('/:projectId/plans/import', importPlans);
router.put('/:projectId/plans/:id', updatePlan);
router.delete('/:projectId/plans/:id', deletePlan);
router.post('/:projectId/plans/match', matchPlans);

// Project reset
router.delete('/:projectId/reset', ResetProjectData);
router.delete('/_all/reset', ResetAllData);

module.exports = router;