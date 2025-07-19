const express = require('express');

  const {
    GetThreeLegged,
    GetToken,} = require('../controllers/auth/auth.controller');

const router = express.Router();

router.get('/three-legged', GetThreeLegged);
router.get('/token', GetToken);

module.exports = router;