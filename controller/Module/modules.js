const Module = require('../../model/Module/modules');

exports.getModules = async (req, res) => {
  try {
    const modules = await Module.find({});
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
