import express from "express";
import axios from "axios";
import problem from "../models/problem.js";
import submission from "../models/submission.js";
import { isAuthorized } from "../middlewares/auth.js";

const router = express.Router();

const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL || "http://localhost:2358";
const JUDGE0_TOKEN = process.env.JUDGE0_TOKEN || "";

const getLanguageId = (language) => {
  const languageMap = {
    python: 71,
    cpp: 54,
    java: 62,
    javascript: 63,
  };
  return languageMap[language] || null;
};

const decodeBase64 = (base64Str) => {
  if (!base64Str) return "";
  const buffer = Buffer.from(base64Str, "base64");
  return buffer.toString("utf-8");
};

const normalizeOutput = (output) => {
  if (!output || typeof output !== "string") {
    return ""; // Return an empty string if output is not valid
  }
  return output
    .replace(/\r\n/g, "\n") // Normalize line breaks first
    .trim(); // Trim the output
};

const logServerInstance = (response, requestType) => {
  const instance = response.headers["x-server-instance"];
  console.log(`${requestType} handled by instance:`, instance);
  console.log("Response status:", response.status);
};

// Add a simple request counter for basic load monitoring
let requestCounter = 0;

// Add queue monitoring
const queueStatus = {
  pending: 0,
  processing: 0,
};

// Add rate limiting configuration
const userSubmissionLimits = {
  windowMs: 60000, // 1 minute
  maxRequests: 20, // max requests per minute per user
};
const userSubmissionCounts = new Map();

// Add this function to manage rate limiting
const checkRateLimit = (userId) => {
  const now = Date.now();
  const userCount = userSubmissionCounts.get(userId) || {
    count: 0,
    timestamp: now,
  };

  if (now - userCount.timestamp > userSubmissionLimits.windowMs) {
    // Reset if window has passed
    userCount.count = 1;
    userCount.timestamp = now;
  } else if (userCount.count >= userSubmissionLimits.maxRequests) {
    // Fixed typo: maxRequits -> maxRequests
    return false; // Rate limit exceeded
  } else {
    userCount.count++;
  }

  userSubmissionCounts.set(userId, userCount);
  return true;
};

router.post("/run-code", isAuthorized, async (req, res) => {
  const { code, language, allTestCases, problemId } = req.body;
  const userId = req.user?.id;

  // Check rate limit
  if (!checkRateLimit(userId)) {
    return res.status(429).json({
      success: false,
      message: "Too many submissions. Please wait before trying again.",
    });
  }

  // Increment queue counter
  queueStatus.pending++;
  requestCounter = (requestCounter + 1) % Number.MAX_SAFE_INTEGER;

  try {
    console.log(req.body);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (!code || !language || !problemId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input. Missing required fields.",
      });
    }

    const languageId = getLanguageId(language);
    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: "Unsupported programming language.",
      });
    }

    const problemData = await problem.findById(problemId).select("testCases");

    if (
      !problemData ||
      !problemData.testCases ||
      problemData.testCases.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: "No test cases found for the given problem ID.",
      });
    }

    let selectedTestCases;

    if (!allTestCases) {
      selectedTestCases = problemData.testCases.filter(
        (testCase) => !testCase.is_hidden,
      );
    } else {
      selectedTestCases = problemData.testCases; // Run all test cases during submission
    }

    if (selectedTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No visible test cases available for execution.",
      });
    }

    const submissions = selectedTestCases.map((testCase) => ({
      source_code: code,
      language_id: languageId,
      stdin: testCase.inputs || "",
      expected_output: testCase.outputs || "",
      cpu_time_limit: testCase.cpu_time_limit || 2, // Default to 2 seconds if not provided
      memory_limit: testCase.memory_limit * 1024 || 128 * 1024, // Default to 128 MB if not provided
    }));

    // Add request tracking
    console.log(`Processing request #${requestCounter} for user ${userId}`);
    queueStatus.pending--;
    queueStatus.processing++;

    // Modify your submission code to include retry logic
    const submitToJudge0 = async (submission, retryCount = 3) => {
      for (let i = 0; i < retryCount; i++) {
        try {
          const response = await axios.post(
            `${JUDGE0_BASE_URL}/submissions`,
            submission,
            {
              headers: {
                "X-Auth-Token": JUDGE0_TOKEN,
                "X-Request-ID": `${userId}-${requestCounter}-${i}`, // Add request tracking
              },
              timeout: 10000, // 10 second timeout
            },
          );

          // Log which instance handled the request
          logServerInstance(response, "Submission");
          return response;
        } catch (error) {
          console.error(`Submission attempt ${i + 1} failed:`, error.message);
          if (i === retryCount - 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
      }
    };

    // Modify your results fetching to include better error handling
    const fetchResults = async (token) => {
      let result = null;
      let retries = 0;
      const maxRetries = 5;
      const maxWaitTime = 30000; // 30 seconds maximum wait time
      const startTime = Date.now();

      while (!result || result.status.id <= 2) {
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error("Execution time exceeded maximum wait time");
        }

        try {
          const response = await axios.get(
            `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true&fields=*`,
            {
              headers: {
                "X-Auth-Token": JUDGE0_TOKEN,
                "X-Request-ID": `${userId}-${requestCounter}-result-${retries}`,
              },
            },
          );

          result = response.data;
          logServerInstance(response, "Status Check");

          if (result.status.id <= 2 && retries < maxRetries) {
            retries++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            continue;
          }

          break;
        } catch (error) {
          console.error(
            `Result fetch attempt ${retries + 1} failed:`,
            error.message,
          );
          if (retries >= maxRetries) throw error;
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
      }

      return {
        ...result,
        compilationError: result.compile_output
          ? decodeBase64(result.compile_output)
          : null,
        standardError: result.stderr ? decodeBase64(result.stderr) : null,
        error: result.status.id === 5 ? "Time Limit Exceeded" : null,
      };
    };

    // Send code to Judge0 API
    const submissionResponses = await Promise.all(
      submissions.map((submission) => submitToJudge0(submission)),
    );

    const tokens = submissionResponses.map((response) => response.data.token);

    // Fetch execution results
    const results = await Promise.all(tokens.map(fetchResults));

    // Process test results
    const testResults = results.map((result, index) => {
      const decodedOutput = decodeBase64(result.stdout?.trim() || "");
      const normalizedOutput = normalizeOutput(decodedOutput);
      const expectedOutput = normalizeOutput(
        selectedTestCases[index]?.outputs || "",
      );

      return {
        input: selectedTestCases[index]?.inputs || "",
        expectedOutput: selectedTestCases[index]?.outputs || "",
        output: decodedOutput,
        error: result.error || result.compilationError || result.standardError,
        passed: normalizedOutput === expectedOutput && !result.error,
        time: result.time,
        memory: result.memory,
      };
    });

    console.log("Test Results:", testResults);

    // Compute performance metrics
    const overallTime =
      testResults.reduce((sum, test) => sum + parseFloat(test.time || 0), 0) *
      1000; // Convert to ms
    const averageMemory =
      testResults.length > 0
        ? testResults.reduce(
            (sum, test) => sum + parseInt(test.memory || 0),
            0,
          ) / testResults.length
        : 0;

    const numberOfTestCase = testResults.length;
    const numberOfTestCasePass = testResults.filter(
      (test) => test.passed,
    ).length;

    // Calculate marks for each test case
    const testCaseResults = testResults.map((test, index) => ({
      input: test.input,
      expectedOutput: test.expectedOutput,
      output: test.output,
      error: test.error,
      passed: test.passed,
      time: test.time,
      memory: test.memory,
      is_hidden: selectedTestCases[index]?.is_hidden || false,
      marks:
        test.passed && selectedTestCases[index]?.marks
          ? selectedTestCases[index].marks
          : 0,
    }));

    const totalMarks = testCaseResults.reduce(
      (sum, test) => sum + test.marks,
      0,
    );
    const submissionStatus =
      numberOfTestCase === numberOfTestCasePass ? "completed" : "rejected";

    console.log("Submission Metrics:");
    console.log("Total Test Cases:", numberOfTestCase);
    console.log("Passed Test Cases:", numberOfTestCasePass);
    console.log("Total Marks Obtained:", totalMarks);
    console.log("Submission Status:", submissionStatus);

    // Save the submission only if all test cases were run
    let savedSubmission = null;
    if (allTestCases) {
      const submissionPayload = {
        user_id: userId,
        problem_id: problemId,
        code,
        language,
        status: submissionStatus,
        execution_time: overallTime.toFixed(2),
        memory_usage: (averageMemory / 1024).toFixed(2), // Convert to MB
        numberOfTestCase,
        numberOfTestCasePass,
        totalMarks,
        testCaseResults, // Store full test cases data in DB
      };

      const submissionResponse = await submission.create(submissionPayload);
      savedSubmission = submissionResponse;
    }

    // Mask test case details except for the first one in the response
    res.json({
      success: true,
      testResults: testResults.map((test, index) => ({
        input: selectedTestCases[index].is_hidden ? "******" : test.input,
        expectedOutput: selectedTestCases[index].is_hidden
          ? "******"
          : test.expectedOutput,
        output: selectedTestCases[index].is_hidden ? "******" : test.output,
        error: test.error,
        passed: test.passed,
        time: test.time,
        memory: test.memory,
        marks: test.marks,
      })),
      overallTime: overallTime.toFixed(2),
      averageMemory: (averageMemory / 1024).toFixed(2), // Convert to MB
      allPassed: testResults.every((test) => test.passed),
      savedSubmission: savedSubmission
        ? {
            ...savedSubmission._doc,
            testCaseResults: savedSubmission.testCaseResults.map(
              (test, index) => ({
                input: test.is_hidden ? "******" : test.input,
                expectedOutput: test.is_hidden ? "******" : test.expectedOutput,
                output: test.is_hidden ? "******" : test.output,
                error: test.error,
                passed: test.passed,
                time: test.time,
                memory: test.memory,
                marks: test.marks,
              }),
            ),
          }
        : null,
      queueStatus,
    });

    // Update queue status after processing
    queueStatus.processing--;
  } catch (error) {
    // Update queue status on error
    queueStatus.processing--;

    console.error("Error during execution:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: "An error occurred while processing the code.",
      error: error.message || error,
      queueStatus,
    });
  }
});

// Add a new endpoint to check queue status
router.get("/queue-status", isAuthorized, (req, res) => {
  res.json({
    success: true,
    queueStatus,
    activeUsers: userSubmissionCounts.size,
  });
});

export default router;
