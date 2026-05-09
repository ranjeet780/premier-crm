const Task = require('../../../model/Task/Task');
const Employee = require('../../../model/SignUp/SignUp'); // If needed for further employee info

// Controller function to get tasks by employee ID
const getTasksByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    // Find tasks where the assignedTo array contains this employeeId
    const tasks = await Task.find({ assignedTo: employeeId }).sort({ dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks by employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getTasksByEmployee };
