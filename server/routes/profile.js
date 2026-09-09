import express from "express";
import {
  getProfile,
  editProfile,
  changePassword,
} from "../controllers/profile.js";
import { isAuthorized } from "../middlewares/auth.js"; // Middleware to authenticate the user
import {
  profileInputValidator,
  passwordInputValidator,
} from "../middlewares/validation.js"; // Add validation as needed

const router = express.Router();

// Middleware to protect the routes
router.use(isAuthorized);

router.route("/").get(getProfile).put(profileInputValidator, editProfile);

router.route("/password").put(passwordInputValidator, changePassword);

export default router;
