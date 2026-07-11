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
