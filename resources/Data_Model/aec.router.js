const express = require('express');
const router = express.Router();

const { GetModelSheets } = require('./aec.controller');

router.get ('/graphql-hubs', GetModelSheets);

module.exports = router;