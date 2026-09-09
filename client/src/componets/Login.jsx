import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfilePicThunk, setImageUrl, setLoading, setUser } from "../redux/userSlice";
import axiosInstance from "../utils/axiosInstance";
import { SEM, BRANCH } from "../utils/constants";
import PasswordChange from "./PassWordChange";
import { ClipLoader } from "react-spinners";

const Login = () => {
  const user = useSelector((store) => store.app.user);
  const [isLogin, setIsLogin] = useState(true);
  const authStatus = useSelector((store) => store.app.authStatus);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [idOrEmail, setIdOrEmail] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [branch, setBranch] = useState("");
  const [sem, setSem] = useState("");
  const [batch, setBatch] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoading = useSelector((store) => store.app.isLoading);
  const [userType, setUserType] = useState("");
  const [isLoad, setIsLoad] = useState(false);

  const toggleLogin = () => {
    setIsLogin(!isLogin);
  };

  useEffect(() => {
    if (authStatus) {
      navigate("/browse");
    } else {
      navigate("/");
    }
  }, [authStatus]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        if (userType === "student") {
          setIsLoad(true);
          const res = await axiosInstance.get("auth/fetch-subjects");
          if (res.data.success) {
            // console.log(res.data.subjects);
            setSubjects(res.data.subjects);
          }
          setIsLoad(false);
        }
      } catch (error) {
        setIsLoad(false);
        console.error("Failed to fetch subjects:", error);
      }
    };

    fetchSubjects();
  }, [userType]);

  const validateRegistration = () => {
    if (!username || !idOrEmail || !userType || !subject) {
      toast.error("Username, ID/Email, User Type, and Subject are required.");
      return false;
    }
    if (userType === "student") {
      if (!mobileNo || !branch || !sem || !batch) {
        toast.error("All fields are required for student registration.");
        return false;
      }
      if (mobileNo.length !== 10 || !/^\d+$/.test(mobileNo)) {
        toast.error("Mobile number must be 10 digits.");
        return false;
      }
    } else if (userType === "faculty") {
      if (!/\S+@\S+\.\S+/.test(idOrEmail)) {
        toast.error("Please enter a valid email for faculty.");
        return false;
      }
    }
    return true;
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    if (!validateRegistration()) return;

    const selectedSubject = subjects.find((subj) => subj.id === subject);
    const newUser = {
      username,
      id: userType === "student" ? idOrEmail.toLowerCase() : undefined, // Convert ID to lowercase
      facultyId: userType === "student" ? selectedSubject.id : undefined,
      email: userType === "faculty" ? idOrEmail.toLowerCase() : undefined, // Convert email to lowercase
      mobileNo: userType === "student" ? mobileNo : undefined,
      branch: userType === "student" ? branch.toLowerCase() : undefined, // Convert branch to lowercase
      semester: userType === "student" ? sem : undefined,
      batch: userType === "student" ? batch.toLowerCase() : undefined,
      subject: userType === "student" ? selectedSubject.subject : subject,
      role: userType,
    };

    // console.log(newUser);

    try {
      dispatch(setLoading(true));

      const res = await axiosInstance.post("auth/register", newUser);

      if (res.data.success) {
        toast.success(res.data.message);
        setIsLogin(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed.");
    } finally {
      dispatch(setLoading(false));
    }
  };

  const validateLogin = () => {
    if (!idOrEmail || !password) {
      toast.error("ID/Email and password are required for login.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;

    dispatch(setLoading(true));
    const user = {
      [idOrEmail.includes("@") ? "email" : "id"]: idOrEmail.toLowerCase(),
      password,
    };

    // console.log("This is user: ", user);
    try {
      const url = `auth/login`;
      const res = await axiosInstance.post(url, user);
      console.log(res.data);
      if (res.data.success) {
        const { firstTimeLogin, message } = res.data;
        if (firstTimeLogin) {
          setIsFirstTime(true);
          toast.success("Welcome to your first login!");
          return;
        }

        const { user: loggedInUser } = res.data;
        toast.success(message || "Login successful!");
        dispatch(setUser(loggedInUser));
        dispatch(setLoading(true));
        dispatch(fetchProfilePicThunk());
        dispatch(setLoading(false));
        navigate("/browse");
      } else {
        toast.error(res.data.message || "Login failed!");
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || "An error occurred during login.";
      toast.error(errorMessage);
    } finally {
      dispatch(setLoading(false));
      resetForm();
    }
  };

  const resetForm = () => {
    setFullName("");
    setUsername("");
    setIdOrEmail("");
    setPassword("");
  };

  return (
    <>
      <div style={{ backgroundColor: "black" }}>
        <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-r overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
          {isFirstTime ? (
            <PasswordChange id={idOrEmail} />
          ) : (
            <form
              onSubmit={isLogin ? handleLogin : handleRegistration}
              className="flex flex-col w-full max-w-lg p-8 space-y-6 bg-gray-900 bg-opacity-90 rounded-lg shadow-lg"
            >
              <h1 className="text-4xl text-white font-bold text-center">
                {isLogin ? "Login" : "Signup"}
              </h1>
              {!isLogin && (
                <>
                  {/* username */}
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    type="text"
                    placeholder="Username"
                    className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
                  />

                  {/* idOrEmail and userType */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      value={idOrEmail}
                      onChange={(e) => setIdOrEmail(e.target.value)}
                      type={userType === "faculty" ? "email" : "text"}
                      placeholder={
                        userType === "faculty" ? "Faculty Email" : "Student ID"
                      }
                      className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />

                    <select
                      id="userType"
                      value={userType}
                      onChange={(e) => {
                        setUserType(e.target.value);
                        setSubject("");
                      }}
                      className="p-3 w-full cursor-pointer rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        -- Select User Type --
                      </option>
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>

                  {/* For Students: branch, semester, batch, mobileNo */}
                  {userType === "student" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="p-4 cursor-pointer rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select Branch</option>
                          {Object.values(BRANCH).map((branchOption, index) => (
                            <option key={index} value={branchOption}>
                              {branchOption}
                            </option>
                          ))}
                        </select>

                        <select
                          value={sem}
                          onChange={(e) => setSem(e.target.value)}
                          className="p-4 cursor-pointer rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select Semester</option>
                          {Object.values(SEM).map((semOption, index) => (
                            <option key={index} value={semOption}>
                              Semester {semOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={batch}
                          onChange={(e) => setBatch(e.target.value)}
                          className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="" disabled>
                            Select Batch
                          </option>
                          <option value="a1">A1</option>
                          <option value="b1">B1</option>
                          <option value="c1">C1</option>
                          <option value="d1">D1</option>
                          <option value="a2">A2</option>
                          <option value="b2">B2</option>
                          <option value="c2">C2</option>
                          <option value="d2">D2</option>
                        </select>

                        <input
                          value={mobileNo}
                          onChange={(e) => setMobileNo(e.target.value)}
                          type="text"
                          placeholder="Mobile No"
                          className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Subject */}
                  <div className="mt-4">
                    {userType === "student" && (
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="p-4 w-full cursor-pointer rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          -- Select Subject --
                        </option>
                        {subjects.map((subj, index) => (
                          <option key={index} value={subj.id}>
                            {subj.subject} ({subj.teacher})
                          </option>
                        ))}
                      </select>
                    )}

                    {userType === "faculty" && (
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        type="text"
                        placeholder="Enter Subject"
                        className="p-4 w-full rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                </>
              )}
              {isLogin && (
                <>
                  <input
                    value={idOrEmail}
                    onChange={(e) => setIdOrEmail(e.target.value)}
                    type="name"
                    placeholder="Id"
                    className="p-4 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="relative w-full">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="p-4 w-full rounded-md bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 focus:outline-none"
                    >
                      {showPassword ? (
                        <span>🔓</span>
                      ) : (
                        <span>🔒</span> //
                      )}
                    </button>
                  </div>
                </>
              )}
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-md transition-transform transform hover:scale-105 focus:scale-95"
              >
                {isLoading ? "Loading..." : isLogin ? "Login" : "Signup"}
              </button>
              <p className="text-white text-center">
                {isLogin ? "New to Coding App?" : "Already have an account?"}
                <span
                  onClick={toggleLogin}
                  className="ml-2 text-blue-500 cursor-pointer hover:underline"
                >
                  {isLogin ? "Signup" : "Login"}
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;