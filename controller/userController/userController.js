const bcrypt = require('bcryptjs');
const User = require('../../model/Users/Users');

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, permissions } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ msg: "User already exists" });
    }

    // DO NOT HASH PASSWORD HERE -- let schema middleware handle it
    const newUser = new User({
      name,
      email,
      password, // store plain text, it will get hashed by pre-save middleware!
      role,
      department,
      permissions,
      createdBy: req.user?._id || null,
    });

    await newUser.save();
    res.status(201).json({ msg: "User created successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Error creating user", error: err.message });
  }
};


const updatePermission = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, role, department, permissions } = req.body;

    // Check for duplicate email
    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) {
      return res.status(409).json({ msg: "Email already in use by another user" });
    }

    // Prepare the update object
    const updateData = {
      name,
      email,
      role,
      department,
      permissions,
    };

    // If updating password, hash it first
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Find user by ID and update
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ msg: "User updated successfully", user: updatedUser });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Error updating user" });
  }
};

const getAllAdminUsers = async (req, res) => {
  try {
    // Optional: Add filtering, pagination, etc.
    const users = await User.find().select('-password'); // Excludes password field
    res.json({ users });
  } catch (err) {
    res.status(500).json({ msg: 'Error fetching users', error: err.message });
  }
};
const getAdminUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password'); // Excludes password
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: 'Error fetching user', error: err.message });
  }
};
const deleteAdminUserById = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json({ msg: "User deleted successfully", user: deletedUser });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting user", error: err.message });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { userId } = req.params; // User ID to update
    const { newPassword } = req.body; // New plaintext password

    if (!newPassword) {
      return res.status(400).json({ msg: "New password is required" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password in DB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ msg: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Error resetting password", error: err.message });
  }
};

module.exports = { createUser, updatePermission  , getAllAdminUsers , getAdminUserById , deleteAdminUserById

  ,resetPassword
}  ;
