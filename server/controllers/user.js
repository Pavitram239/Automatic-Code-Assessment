import User from "../models/user.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { createToken } from "../utils/jwt.js";

// Get all users
export const getUsers = async (req, res) => {
  const users = await User.find({}, { password: 0 }); // Exclude password from the results4
  // console.log("hello")
  res.status(StatusCodes.OK).json({ status: "success", data: users });
};

// Get a single user by ID
export const getUser = async (req, res) => {
  const user = await User.findById(req.params.id, { password: 0 });
  if (!user) throw new NotFoundError("User not found");

  res.status(StatusCodes.OK).json({ status: "success", data: user });
};

// Create a new user (Admin only)
export const createUser = async (req, res) => {
  const user = await User.create(req.body); // Create user with provided details
  const token = await createToken({ id: user._id, role: user.role }); // Generate token for the new user
  res
    .status(StatusCodes.CREATED)
    .json({ status: "success", data: user, token }); // Respond with user data and token
};

import jwt from "jsonwebtoken";

// Edit a user (Admin only)
// Edit a user (Admin only)
export const updateUser = async (req, res) => {
  try {
    const {
      fullName,
      gender,
      location,
      birthday,
      github,
      skills,
      education,
      linkedIn,
      name,
      bio,
      email
    } = req.body;

    console.log(req.body);

    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized", success: false });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, "ChauhanRutvik");
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired token", success: false });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // Ensure fullName and name are not empty strings
    if (!fullName?.trim() || !name?.trim()) {
      return res.status(400).json({
        message: "Username and profile name cannot be empty.",
        success: false,
      });
    }

    // Update only the allowed fields
    user.username = fullName;
    user.profile.name = name;
    user.email = email;
    user.profile = Object.assign(user.profile, {
      bio: bio,
      gender: gender,
      location: location,
      birthday: birthday,
      github: github,
      skills: skills,
      education: education,
      linkedIn: linkedIn,
    });

    console.log("--> ",user);

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        username: user.username,
        profile: user.profile,
        email: user.email,
      },
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};

// Delete a user (Admin only)
export const deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new NotFoundError("User not found");

  res.status(StatusCodes.OK).json({ status: "success", msg: "User deleted" });
};
