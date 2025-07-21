const express = require('express');
const router = express.Router();

const { GetProjects } = require('../controllers/acc/acc.projects.controller');

router.get ('/acc-projects', GetProjects);

module.exports = router;