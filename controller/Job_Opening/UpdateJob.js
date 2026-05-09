const JobOpening = require("../../model/JobOpening/JobOpening");
const path = require("path");

const normalizeResumeKey = (value = "") => {
  const cleaned = String(value).trim().split("?")[0].split("#")[0];
  return path.basename(cleaned);
};

const updateVacancy = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { count } = req.body; 

    const job = await JobOpening.findOne({ jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });
    
    if (job.availableVacancies <= 0 && count > 0) { 
      return res.status(400).json({ message: "No vacancies available" });
    }

    job.selected_emp += count; 
    job.availableVacancies = job.no_of_Opening - job.selected_emp;

    await job.save();

    // fetch updated job with populated fields
    const populatedJob = await JobOpening.findOne({ jobId })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    res.status(200).json({ message: "Vacancy updated", job: populatedJob });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const selectResumeForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { resumeUrl } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ message: "resumeUrl is required." });
    }

    const job = await JobOpening.findOne({ jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (Number(job.availableVacancies) <= 0) {
      return res.status(400).json({ message: "No vacancies available" });
    }

    const selectedSet = new Set((job.selectedResumes || []).map(normalizeResumeKey));
    const blockedSet = new Set((job.blockedResumes || []).map(normalizeResumeKey));
    const alreadySelected = selectedSet.has(normalizeResumeKey(resumeUrl));
    if (alreadySelected) {
      return res.status(409).json({ message: "This resume is already selected." });
    }
    if (blockedSet.has(normalizeResumeKey(resumeUrl))) {
      return res.status(403).json({ message: "This resume is blocked for this job." });
    }

    job.selected_emp += 1;
    job.selectedResumes = [...(job.selectedResumes || []), resumeUrl];
    await job.save();

    const populatedJob = await JobOpening.findOne({ jobId })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    return res.status(200).json({ message: "Resume selected successfully", job: populatedJob });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const unselectResumeForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { resumeUrl } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ message: "resumeUrl is required." });
    }

    const job = await JobOpening.findOne({ jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const targetKey = normalizeResumeKey(resumeUrl);
    const selectedSet = new Set((job.selectedResumes || []).map(normalizeResumeKey));
    if (!selectedSet.has(targetKey)) {
      return res.status(404).json({ message: "This resume is not selected." });
    }

    job.selectedResumes = (job.selectedResumes || []).filter(
      (item) => normalizeResumeKey(item) !== targetKey
    );
    job.selected_emp = Math.max(0, Number(job.selected_emp || 0) - 1);

    await job.save();

    const populatedJob = await JobOpening.findOne({ jobId })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    return res.status(200).json({ message: "Resume unselected successfully", job: populatedJob });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const blockResumeForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { resumeUrl } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ message: "resumeUrl is required." });
    }

    const job = await JobOpening.findOne({ jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const targetKey = normalizeResumeKey(resumeUrl);
    const alreadyBlocked = new Set((job.blockedResumes || []).map(normalizeResumeKey)).has(targetKey);
    if (alreadyBlocked) {
      return res.status(409).json({ message: "This resume is already blocked." });
    }

    job.blockedResumes = [...(job.blockedResumes || []), resumeUrl];

    await job.save();

    const populatedJob = await JobOpening.findOne({ jobId })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    return res.status(200).json({ message: "Resume blocked successfully", job: populatedJob });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const unblockResumeForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { resumeUrl } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({ message: "resumeUrl is required." });
    }

    const job = await JobOpening.findOne({ jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const targetKey = normalizeResumeKey(resumeUrl);
    const blockedSet = new Set((job.blockedResumes || []).map(normalizeResumeKey));
    if (!blockedSet.has(targetKey)) {
      return res.status(404).json({ message: "This resume is not blocked." });
    }

    job.blockedResumes = (job.blockedResumes || []).filter(
      (item) => normalizeResumeKey(item) !== targetKey
    );

    await job.save();

    const populatedJob = await JobOpening.findOne({ jobId })
      .populate("department", "deptName")
      .populate("service", "serviceName");

    return res.status(200).json({ message: "Resume unblocked successfully", job: populatedJob });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { updateVacancy, selectResumeForJob, unselectResumeForJob, blockResumeForJob, unblockResumeForJob };
