const express = require("express")

const checkSession = require("../../middlewares/checkSession")
const { GetProjects } = require("../controllers/acc/acc.projects.controller")
const {
  GetCurrentUserProjectAccess,
} = require("../controllers/acc/acc.current.user.access.controller")

const router = express.Router()

router.use(checkSession)

router.get("/acc-projects", GetProjects)
router.get("/projects/:projectId/current-user-access", GetCurrentUserProjectAccess)

module.exports = router
