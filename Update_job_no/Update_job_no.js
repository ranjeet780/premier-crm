const job = require('../model/JobOpening/JobOpening');
const employee = require('../model/SignUp/SignUp');

const job_data = async (req, res) => {
    try {
        const jobs = await job.find();

        const job_status = await Promise.all(
            jobs.map(async (job) => {
                const selectedCount = await employee.countDocuments({
                    jobId: job.jobId,
                    designation: job.designation,
                    deptName: job.deptName
                });

                return {
                   
                    ...job.toObject(),
                    selected_emp: selectedCount,
                    availableVacancies:  Math.max(0, job.no_of_Opening - selectedCount),
                    
                };
            })
        );

        res.json(job_status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { job_data };
