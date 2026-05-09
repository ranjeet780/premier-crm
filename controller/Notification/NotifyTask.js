const Task = require('../../model/Task/Task');
const Notifiy = require('../../model/Notification/Notice'); // your Notice model

const notifyTask = async (req, res) => {
  try {
    const { taskId } = req.body;

    // Find the task and populate assigned employees
    const task = await Task.findById(taskId).populate('assignedTo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    let createdCount = 0;

    for (const employee of task.assignedTo) {
      // Create a new notice for each employee
      const notice = new Notifiy({
        title: `Task Updated: ${task.title}`,
        description: `Task "${task.title}" has been updated and assigned to you.`,
        category: "Task",
        createdBy: task.createdBy, // optional if you have creator info
        targets: {
          all: false,
          employees: [employee._id]
        },
        notifyVia: {
          email: false, // set true if you want email notification
          inApp: true,
          push: false
        }
      });

      await notice.save(); // save in DB
      createdCount++;

      // Emit real-time notification via Socket.io
      if (global.io) {
        global.io.to(employee._id.toString()).emit('newNotification', {
          title: notice.title,
          description: notice.description,
          noticeId: notice._id,
        });
      }
    }

    res.json({
      message: 'Notice(s) created and emitted successfully',
      createdCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { notifyTask };
