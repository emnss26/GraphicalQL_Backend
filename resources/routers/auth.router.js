const express = require('express');

  const {
    GetThreeLegged,
    GetToken,
    PostLogout} = require('../controllers/auth/auth.controller');

const router = express.Router();

router.get('/three-legged', GetThreeLegged);
router.get('/token', GetToken);
router.post('/logout', PostLogout)

module.exports = router;