const express = require("express")

const checkSession = require("../../middlewares/checkSession")
const { GetProjects } = require("../controllers/acc/acc.projects.controller")

const router = express.Router()

router.use(checkSession)

router.get("/acc-projects", GetProjects)

module.exports = router
