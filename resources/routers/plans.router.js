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
  listTrackingRestrictions,
  upsertTrackingRestriction,
  bulkUpsertTrackingRestrictions,
  listControlComments,
  upsertControlComment,
  bulkUpsertControlComments,
} = require("../controllers/plans/plan.view.modes.controller")
const {
  ResetProjectData,
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

// Tracking (view mode)
router.get("/:projectId/tracking/restrictions", listTrackingRestrictions)
router.put("/:projectId/tracking/restrictions/:weekKey", upsertTrackingRestriction)
router.post("/:projectId/tracking/restrictions/bulk", bulkUpsertTrackingRestrictions)

// Control (view mode)
router.get("/:projectId/control/comments", listControlComments)
router.put("/:projectId/control/comments", upsertControlComment)
router.post("/:projectId/control/comments/bulk", bulkUpsertControlComments)

// Reset (protected - admin only)
router.delete("/:projectId/reset", checkProjectAdmin, ResetProjectData)
router.delete("/_all/reset", (_req, res) =>
  res.status(410).json({
    success: false,
    message: "Global reset endpoint is disabled",
    data: null,
    error: { code: "ENDPOINT_DISABLED" },
  })
)

module.exports = router
