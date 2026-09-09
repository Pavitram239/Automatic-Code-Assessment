import User from "../models/user.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { StatusCodes } from "http-status-codes";

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id); // Assuming user ID is stored in req.user.id by authenticate middleware
  if (!user) throw new NotFoundError("User not found");

  res.status(StatusCodes.OK).json({ status: "success", data: user });
};

export const editProfile = async (req, res) => {
  const { name, bio, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { "profile.name": name, "profile.bio": bio, "profile.avatar": avatar },
    { new: true, runValidators: true }
  );
  if (!user) throw new NotFoundError("User not found");

  res.status(StatusCodes.OK).json({ status: "success", msg: "Profile updated", data: user });
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) throw new NotFoundError("User not found");

  const isValid = await user.comparePassword(oldPassword);
  if (!isValid) throw new BadRequestError("Old password is incorrect");

  user.password = newPassword; // Password will be hashed in pre-save middleware
  await user.save();

  res.status(StatusCodes.OK).json({ status: "success", msg: "Password changed successfully" });
};
