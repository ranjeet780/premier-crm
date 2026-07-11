const BankAccount = require('../model/BankAccount');

exports.createBankAccount = async (req, res) => {
    try {
        const { bankName, accountName, accountNumber, ifscCode, accountCapital } = req.body;
        if (!bankName || !accountName || !accountNumber || !ifscCode || accountCapital === undefined) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        const newAccount = new BankAccount({ bankName, accountName, accountNumber, ifscCode, accountCapital });
        await newAccount.save();
        res.status(201).json({ success: true, message: "Bank account created successfully", account: newAccount });
    } catch (error) {
        console.error("Error creating bank account", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.getBankAccounts = async (req, res) => {
    try {
        const accounts = await BankAccount.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, accounts });
    } catch (error) {
        console.error("Error fetching bank accounts", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        await BankAccount.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Bank account deleted successfully" });
    } catch (error) {
        console.error("Error deleting bank account", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountName, accountNumber, ifscCode, accountCapital } = req.body;
        
        const updatedAccount = await BankAccount.findByIdAndUpdate(
            id, 
            { bankName, accountName, accountNumber, ifscCode, accountCapital }, 
            { new: true }
        );
        
        if (!updatedAccount) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }
        
        res.status(200).json({ success: true, message: "Bank account updated successfully", account: updatedAccount });
    } catch (error) {
        console.error("Error updating bank account", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
