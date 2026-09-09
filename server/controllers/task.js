import { StatusCodes } from "http-status-codes";
import Task from "../models/task.js";
import { NotFoundError } from "../utils/errors.js";

export const getTasks = async (req, res) => {
  const { filter } = req.query;
  let query = Task.find({ createdBy: req.user.id });
  if (filter) {
    query = query.find({ status: filter });
  }
  const tasks = await query;
  if (tasks.length === 0) throw new NotFoundError("no tasks");
  res.status(StatusCodes.OK).json({ status: "success", tasks: tasks });
};

export const addTask = async (req, res) => {
  req.body.createdBy = req.user.id;
  const task = await Task.create(req.body);
  res
    .status(StatusCodes.CREATED)
    .json({ status: "success", msg: "Task Created!" });
};

export const getTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  res.status(StatusCodes.OK).json({ msg: "success", task: task });
};

export const editTask = async (req, res) => {
  await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res
    .status(StatusCodes.CREATED)
    .json({ msg: "success", msg: "task updated!" });
};

export const deleteTask = async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.status(StatusCodes.CREATED).json({ msg: "success", msg: "task deleted" });
};
