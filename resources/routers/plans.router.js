const express = require("express")

const checkSession = require("../../middlewares/checkSession")
const {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
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

// Reset
router.delete("/:projectId/reset", ResetProjectData)
router.delete("/_all/reset", ResetAllData)

module.exports = router
