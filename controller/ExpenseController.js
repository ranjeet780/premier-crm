const Expense = require('../model/Expense');
const BankAccount = require('../model/BankAccount');

exports.createExpense = async (req, res) => {
    try {
        const { categoryId, amount, bankAccountId, paymentMethod, date } = req.body;
        
        if (!categoryId || !amount || !bankAccountId || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Category, Amount, Bank, and Payment Method are required" });
        }

        const expenseDate = date ? new Date(date) : new Date();

        const bankAccount = await BankAccount.findById(bankAccountId);
        if (!bankAccount) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        if (bankAccount.accountCapital < Number(amount)) {
            return res.status(400).json({ success: false, message: "Insufficient balance in selected bank account" });
        }

        bankAccount.accountCapital -= Number(amount);
        await bankAccount.save();

        const expense = new Expense({ categoryId, amount, bankAccountId, paymentMethod, date: expenseDate });
        await expense.save();

        res.status(201).json({ success: true, message: "Expense added successfully! Capital deducted.", expense });
    } catch (err) {
        console.error("Error creating expense:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find().populate('categoryId').populate('bankAccountId').sort({ date: -1 });
        res.status(200).json({ success: true, expenses });
    } catch (err) {
        console.error("Error fetching expenses:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });

        const bankAccount = await BankAccount.findById(expense.bankAccountId);
        if (bankAccount) {
            bankAccount.accountCapital += expense.amount; // refund capital
            await bankAccount.save();
        }

        await Expense.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Expense deleted and capital refunded" });
    } catch(err) {
        console.error("Error deleting expense:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { categoryId, amount, bankAccountId, paymentMethod, date } = req.body;
        
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        if (expense.bankAccountId.toString() === bankAccountId.toString()) {
            const bankAccount = await BankAccount.findById(bankAccountId);
            if (!bankAccount) return res.status(404).json({ success: false, message: "Bank account not found" });
            
            const diff = Number(amount) - expense.amount;
            if (bankAccount.accountCapital < diff) {
                return res.status(400).json({ success: false, message: "Insufficient balance in bank account for the update" });
            }
            bankAccount.accountCapital -= diff;
            await bankAccount.save();
        } else {
            const oldBank = await BankAccount.findById(expense.bankAccountId);
            const newBank = await BankAccount.findById(bankAccountId);
            
            if (!newBank) return res.status(404).json({ success: false, message: "New bank account not found" });
            
            if (newBank.accountCapital < Number(amount)) {
                return res.status(400).json({ success: false, message: "Insufficient balance in new bank account" });
            }
            
            if (oldBank) {
                oldBank.accountCapital += expense.amount;
                await oldBank.save();
            }
            
            newBank.accountCapital -= Number(amount);
            await newBank.save();
        }

        expense.categoryId = categoryId;
        expense.amount = amount;
        expense.bankAccountId = bankAccountId;
        expense.paymentMethod = paymentMethod;
        if (date) expense.date = new Date(date);
        
        await expense.save();

        res.status(200).json({ success: true, message: "Expense updated successfully" });
    } catch (err) {
        console.error("Error updating expense:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
