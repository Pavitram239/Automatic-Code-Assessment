import mongoose from "mongoose";
import User from "../models/user.js";
import { ROLES } from "../utils/constants.js";

import { config } from "dotenv";
config({ path: "../.env" });

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Check if an admin user already exists
    const existingAdmin = await User.findOne({ role: ROLES.ADMIN });
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.username);
      return;
    }

    // Create the admin user
    const adminData = {
      username: process.env.ADMIN_USERNAME || "admin",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: process.env.ADMIN_PASSWORD || "admin1234",
      role: ROLES.ADMIN,
      batch: "a2",
      isApproved: true,
      firstTimeLogin: false,
    };

    const adminUser = new User(adminData);

    // Save the admin user
    await adminUser.save();
    console.log("Admin user created successfully:", adminUser.username);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
};

createAdmin();
