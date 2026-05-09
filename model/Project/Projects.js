const mongoose = require('mongoose');
const Counter = require('../Counter/Counter');

const ProjectSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department" },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "service" },
    price: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    projectCategory: { type: [String], default: [] },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientLeads", required: true },
    notes: { type: String },
    addMember: [{ type: mongoose.Schema.Types.ObjectId, ref: "SignUp" }],
    addFile: { type: String },
    projectDescription: { type: String },
    projectId: { type: String },
    status: {
        type: String,
        enum: ["Pending", "In Progress", "Completed"],
        default: "Pending"
    },

}, { timestamps: true });

ProjectSchema.pre('save', async function (next) {
    if (!this.isNew || this.projectId) return next();
    try {
        const counter = await Counter.findOneAndUpdate(
            { _id: 'projectId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const year = new Date().getFullYear();
        const seqNum = String(counter.seq).padStart(5, '0');
        this.projectId = `PRO${year}-${seqNum}`;
        next();
    } catch (err) {
        next(err);
    }
});

const Project = mongoose.model('projects', ProjectSchema);
module.exports = Project;
