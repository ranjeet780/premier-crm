const mongoose = require('mongoose')
const Counter = require('../Counter/Counter')
const JobOpeningSchema = new mongoose.Schema({
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "department"
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "service"
    },
    designation: {
        type: String,
        required: false
    },
    no_of_Opening: {
        type: Number,

    },
    selected_emp: {
        type: Number,
        default: 0
    },
    mini_salary: {
        type: String,
        required: false
    },
    max_salary: {
        type: String,
        required: false
    },
    skills: {
        type: String,
        required: false
    },
    job_des: {
        type: String,
        required: false,
    },
    job_type: {
        type: String,
        enum: ["Full Time", "Part Time", "Work from Home", "Work from Office"],
        required: false
    },
    opend_Date: {
        type: Date,
        validate: {
      validator: v => !isNaN(Date.parse(v)),
      message: props => `${props.value} is not a valid date!`
    }
    },
    close_date: {
        type: Date,
        validate: {
      validator: v => !isNaN(Date.parse(v)),
      message: props => `${props.value} is not a valid date!`
    }
    },
    resumeFile: {
        type: String,
        required: false
    },
    resumeFiles: {
        type: [String],
        default: []
    },
    resumeApplicants: {
        type: [{
            applicantName: { type: String, required: true },
            resumeUrl: { type: String, required: true }
        }],
        default: []
    },
    selectedResumes: {
        type: [String],
        default: []
    },
    blockedResumes: {
        type: [String],
        default: []
    },
    jobId: { type: String, unique: true }
}, { timestamps: true })
JobOpeningSchema.pre('save', async function (next) {
    if (!this.isNew || this.jobId) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { _id: 'jobId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const year = new Date().getFullYear();
        const seqNum = String(counter.seq).padStart(5, '0');
        this.jobId = `JOBID${year}-${seqNum}`;
        next();
    } catch (err) {
        next(err);
    }
});
JobOpeningSchema.virtual("availableVacancies").get(function () {
    return this.no_of_Opening - this.selected_emp;
});


JobOpeningSchema.set("toJSON", { virtuals: true });
JobOpeningSchema.set("toObject", { virtuals: true });


const Job_Opening = mongoose.model('JobOpening', JobOpeningSchema);
module.exports = Job_Opening;
