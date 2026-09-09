import amqplib from "amqplib";
import axios from "axios";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

// Adjust import paths based on your folder structure
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://judge0:judge0_rabbitmq_password_123@localhost:5672";
const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL || "http://localhost:2358";
const JUDGE0_TOKEN = process.env.JUDGE0_TOKEN || "";
const SUBMISSION_QUEUE = "code_submissions";
const RESULT_QUEUE = "submission_results";

// Helper functions
const decodeBase64 = (base64Str) => {
  if (!base64Str) return "";
  const buffer = Buffer.from(base64Str, "base64");
  return buffer.toString("utf-8");
};

const normalizeOutput = (output) => {
  if (!output || typeof output !== "string") {
    return "";
  }
  return output.replace(/\r\n/g, "\n").trim();
};

// Connect to MongoDB
// mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/coding-platform")
//   .then(() => console.log("Worker connected to MongoDB"))
//   .catch(err => console.error("MongoDB connection error:", err));

// Import submission model
import("../models/submission.js")
  .then((module) => {
    const Submission = module.default;
    startWorker(Submission);
  })
  .catch((err) => {
    console.error("Failed to import submission model:", err);
  });

async function startWorker(SubmissionModel) {
  let connection;
  let channel;

  try {
    // Connect to RabbitMQ
    console.log("Connecting to RabbitMQ...");
    connection = await amqplib.connect(RABBITMQ_URL);
    console.log("Connected to RabbitMQ");

    channel = await connection.createChannel();

    // Ensure queues exist
    await channel.assertQueue(SUBMISSION_QUEUE, { durable: true });
    await channel.assertQueue(RESULT_QUEUE, { durable: true });

    // Process only one message at a time
    channel.prefetch(1);

    // Listen for submissions
    console.log(`Worker started, listening on ${SUBMISSION_QUEUE} queue`);
    channel.consume(SUBMISSION_QUEUE, async (msg) => {
      if (!msg) return;

      let task;
      try {
        // Parse message content
        task = JSON.parse(msg.content.toString());
        console.log(`Processing submission: ${task.submissionId}`);

        // Process the submission
        const testResults = await processSubmission(task);

        // Save results
        await saveResults(task, testResults, channel, SubmissionModel);

        // Acknowledge the message
        channel.ack(msg);
        console.log(`Successfully processed submission: ${task.submissionId}`);
      } catch (error) {
        console.error(
          `Error processing submission ${task?.submissionId || "unknown"}:`,
          error,
        );

        // Log detailed error information
        if (error.response) {
          console.error("Response error:", {
            status: error.response.status,
            data: error.response.data,
          });
        }

        // Send error result back if possible
        if (task && channel) {
          try {
            const errorResult = {
              submissionId: task.submissionId,
              userId: task.userId,
              problemId: task.problemId,
              status: "error",
              error: error.message,
              allTestCases: task.allTestCases,
              testCaseResults: [],
            };

            await channel.sendToQueue(
              RESULT_QUEUE,
              Buffer.from(JSON.stringify(errorResult)),
              { persistent: true },
            );
            console.log(`Sent error result back for ${task.submissionId}`);
          } catch (queueError) {
            console.error("Failed to send error to queue:", queueError);
          }
        }

        // Don't requeue the message to avoid infinite processing loops
        channel.nack(msg, false, false);
      }
    });

    // Handle connection errors
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
      reconnect();
    });

    connection.on("close", () => {
      console.error("RabbitMQ connection closed unexpectedly");
      reconnect();
    });
  } catch (error) {
    console.error("Worker startup error:", error);
    reconnect();
  }

  // Reconnect function
  function reconnect() {
    console.log("Attempting to reconnect in 5 seconds...");
    setTimeout(() => startWorker(SubmissionModel), 5000);
  }
}

async function processSubmission(task) {
  const { submissions, selectedTestCases } = task;

  if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
    throw new Error("Invalid submission data");
  }

  // Submit code to Judge0
  console.log(`Submitting ${submissions.length} test cases to Judge0`);

  const submissionPromises = submissions.map(async (submission, index) => {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        console.log(
          `Submitting test case ${index + 1}/${submissions.length} (attempt ${retries + 1})`,
        );

        const response = await axios.post(
          `${JUDGE0_BASE_URL}/submissions`,
          submission,
          {
            headers: {
              "Content-Type": "application/json",
              "X-Auth-Token": JUDGE0_TOKEN,
            },
            timeout: 10000,
          },
        );

        if (!response.data || !response.data.token) {
          throw new Error("No token received from Judge0");
        }

        console.log(
          `Received token for test case ${index + 1}: ${response.data.token}`,
        );
        return response;
      } catch (error) {
        console.error(
          `Submission failed (attempt ${retries + 1}):`,
          error.message,
        );

        if (error.response) {
          console.error("Response status:", error.response.status);
          console.error("Response data:", error.response.data);
        }

        retries++;

        if (retries >= maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
      }
    }
  });

  // Wait for all submissions to complete
  const submissionResponses = await Promise.allSettled(submissionPromises);

  // Extract tokens from successful submissions
  const tokens = submissionResponses
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value.data.token);

  console.log(`Retrieved ${tokens.length}/${submissions.length} valid tokens`);

  if (tokens.length === 0) {
    throw new Error("All submissions failed");
  }

  // Fetch results for each token
  console.log("Fetching results from Judge0");
  const results = await Promise.all(tokens.map(fetchResults));

  // Process and normalize test results
  return results.map((result, index) => {
    const testCase = selectedTestCases[index];
    const decodedOutput = decodeBase64(result.stdout || "");
    const normalizedOutput = normalizeOutput(decodedOutput);
    const expectedOutput = normalizeOutput(testCase?.outputs || "");

    return {
      input: testCase?.inputs || "",
      expectedOutput: testCase?.outputs || "",
      output: decodedOutput,
      error: result.error || result.compilationError || result.standardError,
      passed: normalizedOutput === expectedOutput && !result.error,
      time: result.time,
      memory: result.memory,
      is_hidden: testCase?.is_hidden || false,
      marks:
        normalizedOutput === expectedOutput && !result.error && testCase?.marks
          ? testCase.marks
          : 0,
    };
  });
}

async function fetchResults(token) {
  let retries = 0;
  const maxRetries = 10;
  const maxWaitTime = 30000;
  const startTime = Date.now();

  while (true) {
    // Check if we've exceeded the maximum wait time
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error("Execution timed out");
    }

    try {
      console.log(
        `Fetching result for token: ${token} (attempt ${retries + 1})`,
      );

      const response = await axios.get(
        `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true&fields=*`,
        {
          headers: {
            "X-Auth-Token": JUDGE0_TOKEN,
          },
          timeout: 5000,
        },
      );

      const result = response.data;

      console.log(
        `Status for ${token}: ${result.status?.id} (${result.status?.description})`,
      );

      // If the code is still processing
      if (result.status?.id <= 2) {
        // Wait a bit longer for processing to complete
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // Process completed result
      return {
        ...result,
        compilationError: result.compile_output
          ? decodeBase64(result.compile_output)
          : null,
        standardError: result.stderr ? decodeBase64(result.stderr) : null,
        error: getErrorMessage(result.status?.id, result.status?.description),
      };
    } catch (error) {
      console.error(
        `Error fetching result (attempt ${retries + 1}):`,
        error.message,
      );

      retries++;

      if (retries >= maxRetries) {
        throw new Error(`Failed to fetch results after ${maxRetries} attempts`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function getErrorMessage(statusId, description) {
  if (!statusId || statusId <= 2) return null;

  switch (statusId) {
    case 3:
      return null; // Accepted, no error
    case 4:
      return "Wrong Answer";
    case 5:
      return "Time Limit Exceeded";
    case 6:
      return "Compilation Error";
    case 7:
      return "Runtime Error (SIGSEGV)";
    case 8:
      return "Runtime Error (SIGXFSZ)";
    case 9:
      return "Runtime Error (SIGFPE)";
    case 10:
      return "Runtime Error (SIGABRT)";
    case 11:
      return "Runtime Error (NZEC)";
    case 12:
      return "Runtime Error (Other)";
    case 13:
      return "Internal Error";
    case 14:
      return "Exec Format Error";
    default:
      return description || "Unknown Error";
  }
}

async function saveResults(task, testResults, channel, SubmissionModel) {
  const { userId, problemId, code, language, submissionId, allTestCases } =
    task;

  // Calculate metrics
  const passedTests = testResults.filter((test) => test.passed).length;
  const totalTests = testResults.length;
  const totalMarks = testResults.reduce(
    (sum, test) => sum + (test.marks || 0),
    0,
  );
  const submissionStatus = passedTests === totalTests ? "accepted" : "rejected";
  const overallTime =
    testResults.reduce((sum, test) => sum + parseFloat(test.time || 0), 0) *
    1000;
  const avgMemory =
    testResults.length > 0
      ? testResults.reduce((sum, test) => sum + parseInt(test.memory || 0), 0) /
        testResults.length
      : 0;

  let savedSubmission = null;

  // Save to database if it's a full submission
  if (allTestCases && SubmissionModel) {
    try {
      console.log(`Saving submission to database: ${submissionId}`);

      const submissionDoc = await SubmissionModel.create({
        user_id: userId,
        problem_id: problemId,
        code,
        language,
        status: submissionStatus,
        execution_time: overallTime.toFixed(2),
        memory_usage: (avgMemory / 1024).toFixed(2),
        numberOfTestCase: totalTests,
        numberOfTestCasePass: passedTests,
        totalMarks,
        testCaseResults,
        metadata: {
          submissionId,
          processedAt: new Date(),
        },
      });

      savedSubmission = submissionDoc;
      console.log(`Submission saved to database: ${submissionId}`);
    } catch (error) {
      console.error(`Error saving submission to database: ${error.message}`);
    }
  }

  // Create formatted result object for sending back to client
  const formattedResult = {
    submissionId,
    userId,
    problemId,
    status: submissionStatus,
    execution_time: overallTime.toFixed(2),
    memory_usage: (avgMemory / 1024).toFixed(2),
    numberOfTestCase: totalTests,
    numberOfTestCasePass: passedTests,
    totalMarks,
    testResults: testResults.map((test) => ({
      input: test.is_hidden ? "******" : test.input,
      expectedOutput: test.is_hidden ? "******" : test.expectedOutput,
      output: test.is_hidden ? "******" : test.output,
      error: test.error,
      passed: test.passed,
      time: test.time,
      memory: test.memory,
      marks: test.marks,
    })),
    allTestCases: !!allTestCases,
    allPassed: passedTests === totalTests,
    overallTime: overallTime.toFixed(2),
    averageMemory: (avgMemory / 1024).toFixed(2),
    savedSubmission: allTestCases ? savedSubmission : null,
  };

  console.log(
    `Results: ${passedTests}/${totalTests} tests passed, total marks: ${totalMarks}`,
  );

  // Send result to queue
  if (channel) {
    try {
      console.log(`Sending results to queue: ${submissionId}`);

      await channel.sendToQueue(
        RESULT_QUEUE,
        Buffer.from(JSON.stringify(formattedResult)),
        { persistent: true },
      );

      console.log(`Results sent to queue: ${submissionId}`);
    } catch (error) {
      console.error(`Error sending results to queue: ${error.message}`);
      throw error; // Re-throw to trigger message rejection
    }
  }

  return formattedResult;
}
