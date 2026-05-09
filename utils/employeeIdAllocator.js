const ReusableEmployeeId = require("../model/SignUp/ReusableEmployeeId");
const SignUp = require("../model/SignUp/SignUp");
const Counter = require("../model/Counter/Counter");

const EMPLOYEE_ID_PATTERN = /^Id(\d{4})-(\d{5})$/;

const parseEmployeeId = (employeeId) => {
  const match = String(employeeId || "").match(EMPLOYEE_ID_PATTERN);
  if (!match) return null;
  return { year: Number(match[1]), seq: Number(match[2]) };
};

const releaseEmployeeId = async ({ employeeId, userId, reason }) => {
  const parsed = parseEmployeeId(employeeId);
  if (!parsed) return;

  await ReusableEmployeeId.updateOne(
    { employeeId },
    {
      $setOnInsert: {
        employeeId,
        year: parsed.year,
        seq: parsed.seq,
        releasedFromUser: userId,
        reason,
      },
    },
    { upsert: true }
  );
};

const claimReusableEmployeeId = async () => {
  const claimed = await ReusableEmployeeId.findOneAndDelete(
    {},
    { sort: { year: 1, seq: 1, createdAt: 1 } }
  ).lean();

  return claimed?.employeeId || null;
};

const allocateBlockedPlaceholderId = async () => {
  for (let i = 0; i < 5; i += 1) {
    const candidate = `BLK-${Date.now()}-${Math.floor(Math.random() * 1e5)
      .toString()
      .padStart(5, "0")}`;
    const exists = await SignUp.exists({ employeeId: candidate });
    if (!exists) return candidate;
  }
  return `BLK-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
};

const allocateNextEmployeeId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "employeeId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const year = new Date().getFullYear();
  const seqNum = String(counter.seq).padStart(5, "0");
  return `Id${year}-${seqNum}`;
};

module.exports = {
  claimReusableEmployeeId,
  releaseEmployeeId,
  allocateBlockedPlaceholderId,
  allocateNextEmployeeId,
};
