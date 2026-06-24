const SignUp = require('../../model/SignUp/SignUp');

const getEmpdatabyID = async (req, res) => {
    try {
        const id = req.params.employeeId;

        let employee = await SignUp.findOne({ employeeId: id })
            .populate("department", "deptName")
            .populate("service", "serviceName")
            .sort({ createdAt: -1 });

        if (!employee) {
            employee = await SignUp.findById(id)
                .populate("department", "deptName")
                .populate("service", "serviceName");
        }

        if (!employee) {
            return res.status(404).json({ message: "Not Found" });
        }

        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEmployeesByDepartment = async (req, res) => {
  try {
    const deptId = req.params.deptId;
    if (!deptId || deptId === "undefined") {
      return res.status(400).json({ message: "Invalid Department ID" });
    }

    const employees = await SignUp.find({ department: deptId });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



module.exports = { getEmployeesByDepartment ,getEmpdatabyID };



