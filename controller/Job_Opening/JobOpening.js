const JobOpening = require('../../model/JobOpening/JobOpening')
const JobOpeningNotification = require('../../model/Notification/JobOpeningNotification')
const Department = require("../../model/Department/AddDepartment");
const Service = require("../../model/Services/Service");
const createRoleBasedNotification = require(
  "../../utils/createRoleBasedNotification"
);
const path = require("path");
  
const extractNameFromResumeUrl = (url = "") => {
  const clean = String(url).split("?")[0].split("#")[0];
  const file = path.basename(clean);
  return file.replace(/\.[^/.]+$/, "") || "resume";
};

const Job_Opening = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      department,
      service,
      designation,
      no_of_Opening,
      selected_emp,
      mini_salary,
      max_salary,
      skills,
      job_des,
      job_type,
      opend_Date,
      close_date
    } = req.body;

    const normalizedSkills = (skills || "").trim().toLowerCase();
    const normalizedDescription = (job_des || "").trim().toLowerCase();
    const normalizedOpenDate = opend_Date ? new Date(opend_Date) : null;
    const normalizedCloseDate = close_date ? new Date(close_date) : null;

    // Prevent duplicate rows for same vacancy payload
    const possibleDuplicate = await JobOpening.findOne({
      department,
      service,
      designation,
      no_of_Opening,
      mini_salary,
      max_salary,
      job_type,
      opend_Date: normalizedOpenDate,
      close_date: normalizedCloseDate,
    });

    const isTextDuplicate =
      possibleDuplicate &&
      (possibleDuplicate.skills || "").trim().toLowerCase() === normalizedSkills &&
      (possibleDuplicate.job_des || "").trim().toLowerCase() === normalizedDescription;

    if (isTextDuplicate) {
      return res.status(409).json({
        message: "This job opening already exists.",
        duplicateId: possibleDuplicate._id,
        duplicateJobId: possibleDuplicate.jobId,
      });
    }

    // 1️⃣ Create Job
    const new_job = new JobOpening({
      department,
      service,
      designation,
      no_of_Opening,
      selected_emp,
      mini_salary,
      max_salary,
      skills,
      job_des,
      job_type,
      opend_Date,
      close_date,
    });

    const save_job = await new_job.save();

    // 2️⃣ Get department & service names
    const departmentData = await Department.findById(department).select("deptName");
    const serviceData = await Service.findById(service).select("serviceName");

    const departmentName = departmentData?.deptName || "Department";
    const serviceName = serviceData?.serviceName || "Service";

    // 🔔 ROLE-BASED NOTIFICATION (NEW SYSTEM)
    await createRoleBasedNotification({
      type: "JOB_CREATED",
      title: `New Job Opened – ${departmentName} / ${serviceName}`,
      message: `Vacancy: ${no_of_Opening} position(s) available`,
      module: "job",
      refId: save_job._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized role
    });

    return res.status(200).json({
      message: "Job added successfully",
      data: save_job,
    });

  } catch (error) {
    console.error("Job Opening Error:", error);
    res.status(500).json({ message: error.message });
  }
};




const get_JobOpening = async (req, res) => {
  try {
    const getData = await JobOpening.find()
      .populate("department", "deptName")
      .populate("service", "serviceName")
      .sort({ createdAt: -1 });
    
    // Backward compatibility: ensure every job always has a serializable resume list
    const normalized = getData.map((jobDoc) => {
      const job = jobDoc.toObject();
      const list = Array.isArray(job.resumeFiles) ? [...job.resumeFiles] : [];
      if (job.resumeFile && !list.includes(job.resumeFile)) {
        list.unshift(job.resumeFile);
      }
      job.resumeFiles = list.filter(Boolean);
      const existingApplicants = Array.isArray(job.resumeApplicants) ? job.resumeApplicants : [];
      const byUrl = new Map(existingApplicants.map((item) => [item.resumeUrl, item]));
      job.resumeApplicants = job.resumeFiles.map((url) => {
        const existing = byUrl.get(url);
        return {
          applicantName: (existing?.applicantName || "").trim() || extractNameFromResumeUrl(url),
          resumeUrl: url,
        };
      });
      return job;
    });

    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: "Error Fetching jobs", error: error });
  }
};


const DeleteJob = async (req, res) => {
  try {
    // 🔐 Ensure auth
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobId = req.params.id;

    const deletedJob = await JobOpening.findByIdAndDelete(jobId);

    if (!deletedJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    // 🔔 ROLE-BASED NOTIFICATION
    await createRoleBasedNotification({
      type: "JOB_DELETED",
      title: "Job Deleted",
      message: `A job opening was deleted by ${req.user.role}`,
      module: "job",
      refId: deletedJob._id,
      actorUserId: req.user.id,               // JWT id
      actorRole: req.user.role.toLowerCase(), // normalized
    });

    res.status(200).json({
      message: "Job deleted successfully",
      deletedJob,
    });

  } catch (error) {
    console.error("Delete Job Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const uploadJobResume = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobId = req.params.id;
    const file = req.file;
    const applicantName = String(req.body?.applicantName || "").trim();

    if (!file) {
      return res.status(400).json({ message: "Resume file is required." });
    }

    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const isPdf =
      ext === ".pdf" ||
      mime === "application/pdf" ||
      mime === "application/x-pdf";

    if (!isPdf) {
      return res.status(400).json({ message: "Only PDF resume files are allowed." });
    }

    const resumeUrl = `${req.protocol}://${req.get("host")}/uploads/resumes/${file.filename}`;
    if (!applicantName) {
      return res.status(400).json({ message: "Applicant name is required." });
    }
    const finalApplicantName = applicantName;

    const updated = await JobOpening.findByIdAndUpdate(
      jobId,
      {
        $set: { resumeFile: resumeUrl },
        $push: {
          resumeFiles: resumeUrl,
          resumeApplicants: { applicantName: finalApplicantName, resumeUrl },
        },
      },
      { new: true }
    )
      .populate("department", "deptName")
      .populate("service", "serviceName");

    if (!updated) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({
      message: "Resume uploaded successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Upload Job Resume Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { Job_Opening, get_JobOpening, DeleteJob, uploadJobResume } 
