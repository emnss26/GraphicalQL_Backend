const express = require('express');
const router = express.Router();

const { GetGraphicalQlHubs } = require('./aec.controller');

router.get ('/graphql-hubs', GetGraphicalQlHubs);

module.exports = router;