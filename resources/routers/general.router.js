const express = require("express");

const { GetUserProfile } = require("../controllers/general/user.profile.controller");

const router = express.Router();

router.get("/userprofile", GetUserProfile);

module.exports = router;
