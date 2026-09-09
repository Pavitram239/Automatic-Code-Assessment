import Problem from '../models/problem.js';

// Create problem
export const createProblem = async (req, res) => {
  const {
    title,
    description,
    difficulty,
    inputFormat,
    outputFormat,
    sampleIO,
    testCases = [],  // Default to an empty array if undefined
    constraints,
    tags,
    createdBy,
    score
  } = req.body;

  console.log("testCases", testCases);

  try {
    const problem = new Problem({
      title,
      description,
      difficulty,
      inputFormat,
      outputFormat,
      sampleIO,
      testCases: testCases.map(testCase => ({
        inputs: testCase.inputs.map((input, index) => ({
          value: input,
          type: testCase.inputTypes[index] // Use index to get corresponding type
        })),
        outputs: testCase.outputs.map((output, index) => ({
          value: output,
          type: testCase.outputTypes[index] // Use index to get corresponding type
        })),
        // Assuming timeLimit and memoryLimit are included in testCase
        timeLimit: testCase.timeLimit,
        memoryLimit: testCase.memoryLimit
      })),
      constraints,
      tags,
      score,
      createdBy: req.user?._id || createdBy,
    });

    const createdProblem = await problem.save();
    res.status(201).json(createdProblem);
  } catch (error) {
    console.log(error + " error");
    res.status(400).json({ message: error.message });
  }
};



// Backend code (Express.js route handler)
export const getProblems = async (req, res) => {
  try {
    const problems = await Problem.find({}).sort({ createdAt: -1 });
    const totalProblems = problems.length; 

    res.json({ problems, totalProblems,succes:true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};





// Get problem by ID
export const getProblemById = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update problem
export const updateProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const updates = req.body;

    // If sampleIO is provided, ensure it's correctly formatted as an array of objects
    if (updates.sampleIO) {
      problem.sampleIO = updates.sampleIO.map(sample => ({
        input: sample.input,
        output: sample.output,
      }));
    }

    // If testCases are provided, ensure they are correctly formatted
    if (updates.testCases) {
      problem.testCases = updates.testCases.map(testCase => ({
        inputs: testCase.inputs.map((input, index) => ({
          value: input, // Ensure input has a value
          type: testCase.inputTypes[index] // Corresponding input type
        })),
        outputs: testCase.outputs.map((output, index) => ({
          value: output, // Ensure output has a value
          type: testCase.outputTypes[index] // Corresponding output type
        })),
        // Assuming timeLimit and memoryLimit are included in testCase
        timeLimit: testCase.timeLimit,
        memoryLimit: testCase.memoryLimit,
      }));
    }

    // Update other fields if they exist in the updates
    Object.keys(updates).forEach(key => {
      if (!['sampleIO', 'testCases'].includes(key)) {
        problem[key] = updates[key];
      }
    });

    const updatedProblem = await problem.save();

    res.json(updatedProblem);
  } catch (error) {
    console.error("Update Problem Error:", error); // Log the error for debugging
    res.status(500).json({ message: error.message });
  }
};



// Delete problem
export const deleteProblem = async (req, res) => {
    try {
      const problem = await Problem.findById(req.params.id);
  
      if (!problem) {
        return res.status(404).json({ message: 'Problem not found' });
      }
  
      await Problem.deleteOne({ _id: req.params.id }); // Use deleteOne instead of remove
      res.json({ message: 'Problem removed' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};