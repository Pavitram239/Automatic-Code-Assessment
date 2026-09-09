import "express-async-errors";
import { config } from "dotenv";
config({ path: "../.env" });
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import notFoundHandler from "./controllers/not-found.js";
import errorHandler from "./controllers/error.js";
import authRoutes from "./routes/auth.js";
import contestRoutes from "./routes/contests.js";
import problemRoutes from "./routes/problem.router.js"; // Problem routes
import user from "./routes/user.router.js";
import cors from "cors";
import compileRoutes from "./routes/compileRoutes.js"; // Import the compile routes
import submissionRoutes from "./routes/submission.router.js"; // Import the submission routes
import adminRouter from "./routes/admin.router.js";
import facultyRouter from "./routes/faculty.router.js";
import compiler from "./routes/compiler.js";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.use(express.json());

const allowedOrigin = (
  process.env.BACKEND_ORIGIN || "http://localhost:5173"
).replace(/\/$/, "");

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
};
// const corsOptions = {
//   origin: "http://192.168.24.235:5173",
//   credentials: true,
// };
app.use(cors(corsOptions));
app.use(express.static("public"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/contests", contestRoutes); // Use contest routes
app.use("/api/v1/problems", problemRoutes); // Use problem routes
app.use("/api/v1/user", user);
app.use("/api/v1/compile", compileRoutes);
app.use("/api/v1/submissions", submissionRoutes); // Use submission routes
app.use("/api/v1/admin", adminRouter); // admin section
app.use("/api/v1/faculty", facultyRouter);
app.use("/api/v1/compiler", compiler);

app.all("*", notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3100;
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("DB Connected");
    app.listen(PORT, process.env.ALL_IP, () => {
      console.log(`server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });

export { mongoose };
