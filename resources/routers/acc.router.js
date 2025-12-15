const express = require('express');
const router = express.Router();
const checkSession = require('../../middlewares/checkSession');

const { GetProjects } = require('../controllers/acc/acc.projects.controller');

// Session middleware
router.use(checkSession);

// Routes
router.get('/acc-projects', GetProjects);

module.exports = router;