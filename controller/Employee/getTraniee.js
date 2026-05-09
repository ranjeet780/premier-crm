
const SignUp = require("../../model/SignUp/SignUp");


const getTraineeData = async (req, res) => {
  try {
    const trainees = await SignUp.find({ userType: { $in: ["trainee", "intern"] } })
      .sort({ createdAt: -1 })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    console.log(JSON.stringify(trainees, null, 2));

    res.status(200).json(trainees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching trainees", error });
  }
};

module.exports = { getTraineeData };
