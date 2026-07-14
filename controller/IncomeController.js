const Income = require('../model/Income');
const Invoice = require('../model/Invoice/Invoice'); // To fetch invoice payments implicitly

exports.createIncome = async (req, res) => {
    try {
        const { source, description, amount, date } = req.body;
        if (!source || !amount) {
            return res.status(400).json({ success: false, message: "Source and Amount are required" });
        }

        const incomeDate = date ? new Date(date) : new Date();
        const newIncome = new Income({ source, description, amount, date: incomeDate });
        await newIncome.save();

        res.status(201).json({ success: true, message: "Income added successfully", data: newIncome });
    } catch (error) {
        console.error("Error creating income", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.getIncomes = async (req, res) => {
    try {
        // Fetch manual incomes
        const manualIncomes = await Income.find().lean();

        // Fetch paid invoices
        const invoices = await Invoice.find({ paidAmount: { $gt: 0 } }).lean();

        let allIncomeSources = [];

        // Add manual incomes
        manualIncomes.forEach(inc => {
            allIncomeSources.push({
                _id: inc._id,
                source: inc.source,
                description: inc.description || "Manual Entry",
                amount: inc.amount,
                date: inc.date,
                isManual: true
            });
        });

        // Add invoice payments
        invoices.forEach(inv => {
            if (inv.payments && inv.payments.length > 0) {
                inv.payments.forEach(payment => {
                    allIncomeSources.push({
                        _id: inv._id, // still pointing to invoice ID so view invoice works
                        source: `Invoice #${inv.invoiceNumber}`,
                        description: `Client: ${inv.clientName || 'Unknown'} | Bank: ${payment.bankName || '-'} | Method: ${payment.method || '-'}`,
                        amount: payment.amount,
                        date: payment.date || inv.paidAt || inv.date,
                        isManual: false
                    });
                });
            } else if (inv.paidAmount > 0) {
                // Fallback for older invoices without `payments` array
                allIncomeSources.push({
                    _id: inv._id,
                    source: `Invoice #${inv.invoiceNumber}`,
                    description: `Client: ${inv.clientName || 'Unknown Client'}`,
                    amount: inv.paidAmount,
                    date: inv.paidAt || inv.date,
                    isManual: false
                });
            }
        });

        // Sort descending by date
        allIncomeSources.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({ success: true, incomes: allIncomeSources });
    } catch (error) {
        console.error("Error fetching incomes", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.deleteIncome = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Income.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, message: "Income not found" });
        res.status(200).json({ success: true, message: "Income deleted successfully" });
    } catch (error) {
        console.error("Error deleting income", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const Project = require('../model/Project/Projects');
const Department = require('../model/Department/AddDepartment');
const Service = require('../model/Services/Service');

exports.getIncomeBreakdown = async (req, res) => {
    try {
        // Fetch all services with departments to match manual names
        const allServices = await Service.find().populate('deptId').lean();
        
        const serviceMap = {};
        allServices.forEach(s => {
            serviceMap[s.serviceName.toLowerCase()] = {
                serviceName: s.serviceName,
                deptName: s.deptId?.deptName || "Uncategorized"
            };
        });

        const invoices = await Invoice.find({ paidAmount: { $gt: 0 } })
            .populate({
                path: 'projects.projectId',
                select: 'department service projectName',
                populate: [
                    { path: 'department', select: 'deptName' },
                    { path: 'service', select: 'serviceName' }
                ]
            }).lean();

        let deptBreakdown = {};
        let serviceBreakdown = {};

        invoices.forEach(inv => {
            if (inv.projects && inv.projects.length > 0) {
                const totalProjAmount = inv.projects.reduce((sum, p) => sum + (p.amount || 0), 0) || 1;
                
                inv.projects.forEach(p => {
                    let dept = "Uncategorized";
                    let serv = "Uncategorized";

                    if (p.projectId && typeof p.projectId === 'object') {
                        dept = p.projectId.department?.deptName || "Uncategorized";
                        serv = p.projectId.service?.serviceName || "Uncategorized";
                    } else {
                        // fallback to string matching
                        const projName = p.projectName || p.name || "";
                        if (projName) {
                            const match = serviceMap[projName.toLowerCase()];
                            if (match) {
                                serv = match.serviceName;
                                dept = match.deptName;
                            } else {
                                serv = projName; // Use what they typed as service
                                dept = "Uncategorized";
                            }
                        }
                    }
                    
                    const allocatedIncome = p.amount ? (p.amount / totalProjAmount) * inv.paidAmount : (inv.paidAmount / inv.projects.length);
                    
                    deptBreakdown[dept] = (deptBreakdown[dept] || 0) + allocatedIncome;
                    serviceBreakdown[serv] = (serviceBreakdown[serv] || 0) + allocatedIncome;
                });
            } else {
                 deptBreakdown["Uncategorized"] = (deptBreakdown["Uncategorized"] || 0) + inv.paidAmount;
                 serviceBreakdown["Uncategorized"] = (serviceBreakdown["Uncategorized"] || 0) + inv.paidAmount;
            }
        });

        const manualIncomes = await Income.find().lean();
        manualIncomes.forEach(inc => {
             deptBreakdown["Manual Entry"] = (deptBreakdown["Manual Entry"] || 0) + inc.amount;
             serviceBreakdown["Manual Entry"] = (serviceBreakdown["Manual Entry"] || 0) + inc.amount;
        });

        const formatBreakdown = (data) => Object.entries(data).map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount - a.amount);

        res.status(200).json({ 
            success: true, 
            breakdown: {
                departments: formatBreakdown(deptBreakdown),
                services: formatBreakdown(serviceBreakdown)
            }
        });
    } catch (error) {
        console.error("Error creating breakdown", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
