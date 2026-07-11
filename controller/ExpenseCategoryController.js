const ExpenseCategory = require('../model/ExpenseCategory');

exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }
        
        // Check if category already exists
        const existing = await ExpenseCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Category already exists" });
        }

        const newCategory = new ExpenseCategory({ name, description });
        await newCategory.save();
        res.status(201).json({ success: true, message: "Expense category added successfully", category: newCategory });
    } catch (error) {
        console.error("Error creating expense category", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.getCategories = async (req, res) => {
    try {
        const categories = await ExpenseCategory.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, categories });
    } catch (error) {
        console.error("Error fetching expense categories", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await ExpenseCategory.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Expense category deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense category", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
