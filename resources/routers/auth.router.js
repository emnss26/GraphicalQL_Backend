const express = require('express');
const router = express.Router();

const {
  GetThreeLegged,
  GetToken,
  PostLogout,
} = require('../controllers/auth/auth.controller');

const { GetUserProfile } = require('../controllers/auth/auth.user.profile.controller');

// OAuth endpoints
router.get('/three-legged', GetThreeLegged);
router.get('/token', GetToken);
router.post('/logout', PostLogout);

// User info
router.get('/userprofile', GetUserProfile);

module.exports = router;