const express = require("express");
const router = express.Router();
const {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlansStub,
} = require("../controllers/plans/aec.project.plans.controller");

const { ResetProjectData, ResetAllData } =
  require('../controllers/plans/aec.db.reset.controller');

router.get("/:projectId/plans", listPlans);
router.post("/:projectId/plans/import", importPlans);
router.put("/:projectId/plans/:id", updatePlan);
router.delete("/:projectId/plans/:id", deletePlan);
router.post("/:projectId/plans/match", matchPlansStub);

router.delete('/:projectId/reset', ResetProjectData);
router.delete('/_all/reset', ResetAllData);

module.exports = router;