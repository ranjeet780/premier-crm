// helpers/calculateSalary.js

module.exports = function calculateSalary({
    basicPay,
    perDaySalary,
    dailyWorkingHours = 9,
    attendance,
    leaves
}) {
    let present = 0, absent = 0, halfDay = 0, late = 0;

    attendance.forEach(a => {
        if (a.status === "Present") present++;
        if (a.status === "Absent") absent++;
        if (a.status === "Half Day") halfDay++;
        if (a.status === "Late") late++;
    });

    let paidLeaves = 0, unpaidLeaves = 0, shortLeavesCount = 0;

    leaves.forEach(l => {
        if (l.leave_type === "Short Leave" || l.leave_category === "Short Leave") {
            shortLeavesCount++;
        } else if (l.paid || l.leave_type === "Paid") {
            paidLeaves += l.days;
        } else {
            unpaidLeaves += l.days;
        }
    });

    const perHourSalary = perDaySalary / dailyWorkingHours;

    // Deduction details
    const deductionDetails = {
        absent: absent * perDaySalary,
        halfDay: halfDay * (perDaySalary / 2),
        late: late * (perDaySalary * 0.25),
        unpaidLeave: unpaidLeaves * perDaySalary,
        shortLeave: shortLeavesCount * perHourSalary
    };

    const totalDeductions =
        deductionDetails.absent +
        deductionDetails.halfDay +
        deductionDetails.late +
        deductionDetails.unpaidLeave +
        deductionDetails.shortLeave;

    const netPay = basicPay - totalDeductions;

    return {
        present,
        absent,
        halfDay,
        late,
        paidLeaves,
        unpaidLeaves,
        shortLeavesCount,
        deductionDetails,
        totalDeductions,
        netPay
    };
};
