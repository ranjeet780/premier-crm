// const mongoose = require('mongoose');

// const LeaveSchema = new mongoose.Schema({
//   employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "SignUp", required: true },
//   leave_type: { type: String, required: true },
//   from_date: { type: Date, required: true },
//   to_date: { type: Date, required: true },
//   reason: { type: String, required: true },
//   status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
//   days: { type: Number },
//   paid: { type: Boolean, default: false },
//   leave_category: { type: String },
//   isHalfDay: { type: Boolean, default: false },
//     adminNote: { type: String, default: "" },
//   leaveId: { type: String }
// }, { timestamps: true });


// // Auto-calc leave days
// LeaveSchema.pre("save", function (next) {
//   if (this.from_date && this.to_date) {
//     const diff = Math.ceil(
//       (this.to_date - this.from_date) / (1000 * 60 * 60 * 24)
//     ) + 1;
//     this.days = diff;
//   }
//   next();
// });


// // Auto generate leaveId
// LeaveSchema.pre("save", async function (next) {
//   if (this.leaveId) return next();

//   const year = new Date().getFullYear();

//   const count = await mongoose.model("leave").countDocuments({
//     createdAt: {
//       $gte: new Date(`${year}-01-01`),
//       $lte: new Date(`${year}-12-31`)
//     }
//   });

//   const serial = String(count + 1).padStart(5, "0");
//   this.leaveId = `LV${year}-${serial}`;

//   next();
// });

// module.exports = mongoose.models.leave || mongoose.model("leave", LeaveSchema);

const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SignUp",
      required: true,
      index: true,
    },

    leave_type: {
      type: String,
      required: true, // Ex: Sick, Casual, Personal
    },

    leave_category: {
      type: String,
      default: "",
    },

    from_date: {
      type: Date,
      required: true,
      index: true,
    },

    to_date: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },

    days: {
      type: Number,
    },

    paid: {
      type: Boolean,
      default: false, // false = Unpaid Leave
    },

    isHalfDay: {
      type: Boolean,
      default: false,
    },

    adminNote: {
      type: String,
      default: "",
    },

    leaveId: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Auto calculate no. of days
LeaveSchema.pre("save", function (next) {
  if (this.from_date && this.to_date) {
    if (this.isHalfDay) {
      this.days = 0.5;
    } else {
      const diff =
        Math.ceil(
          (this.to_date - this.from_date) / (1000 * 60 * 60 * 24)
        ) + 1;
      this.days = diff;
    }
  }
  next();
});

// Auto generate leaveId (collision-safe): LV2025-00001
LeaveSchema.pre("save", async function (next) {
  if (this.leaveId) return next();

  try {
    const year = new Date().getFullYear();
    const prefix = `LV${year}-`;

    // Find last issued leaveId for the year and increment.
    const lastLeave = await mongoose
      .model("Leave")
      .findOne({ leaveId: new RegExp(`^${prefix}\\d{5}$`) })
      .sort({ leaveId: -1 })
      .select("leaveId")
      .lean();

    let nextSerial = 1;
    if (lastLeave?.leaveId) {
      const tail = Number(String(lastLeave.leaveId).replace(prefix, ""));
      if (Number.isFinite(tail) && tail > 0) {
        nextSerial = tail + 1;
      }
    }

    this.leaveId = `${prefix}${String(nextSerial).padStart(5, "0")}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.models.Leave || mongoose.model("Leave", LeaveSchema);
