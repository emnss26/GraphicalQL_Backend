const express = require("express")

const checkSession = require("../../middlewares/checkSession")
const checkProjectAdmin = require("../../middlewares/checkProjectAdmin")
const {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
  listAlerts
} = require("../controllers/plans/aec.project.plans.controller")
const {
  ResetProjectData,
  ResetAllData,
} = require("../controllers/plans/aec.db.reset.controller")

const router = express.Router()

router.use(checkSession)

// Plans
router.get("/:projectId/plans", listPlans)
router.post("/:projectId/plans/import", importPlans)
router.put("/:projectId/plans/:id", updatePlan)
router.delete("/:projectId/plans/:id", deletePlan)
router.post("/:projectId/plans/match", matchPlans)
router.get("/:projectId/alerts", listAlerts);

// Reset (protected - admin only)
router.delete("/:projectId/reset", checkProjectAdmin, ResetProjectData)
router.delete("/_all/reset", checkProjectAdmin, ResetAllData)

module.exports = router
