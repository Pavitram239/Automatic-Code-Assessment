import express from "express";
import {
  addTask,
  deleteTask,
  editTask,
  getTask,
  getTasks,
} from "../controllers/task.js";
import { idValidator, taskInputValidator } from "../middlewares/validation.js";
import { isAuthorized } from "../middlewares/auth.js";
const router = express.Router();

router.use(isAuthorized);
router.route("/").get(getTasks).post(taskInputValidator, addTask);
router
  .route("/:id")
  .all(idValidator)
  .get(getTask)
  .post(taskInputValidator, editTask)
  .delete(deleteTask);

export default router;
