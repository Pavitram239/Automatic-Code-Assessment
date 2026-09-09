import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  createUser,
} from "../controllers/user.js";
import { isAuthorized, isAdmin } from "../middlewares/auth.js";
import { registerInputValidator } from "../middlewares/validation.js";

const router = express.Router();

// Middleware to ensure the user is authenticated
router.use(isAuthorized);

// Get all users (Accessible by all authenticated users)
router.get("/", getUsers);

// Get a single user by ID (Accessible by all authenticated users)
router.get("/:id", getUser);

// Create a new user (Only Admins can create users)
router.post("/", isAdmin, registerInputValidator, createUser);

// Edit a user (Only Admins can edit users)
router.put("/update", updateUser);

// Delete a user (Only Admins can delete users)
router.delete("/:id", isAdmin, deleteUser);

export default router;
