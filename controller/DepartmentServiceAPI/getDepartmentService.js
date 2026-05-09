const DepartmentName = require('../../model/Department/AddDepartment')
const Service = require('../../model/Services/Service')

const getServicebyDepartment= async (req , res)=>{
    try {
        const {deptId} = req.params;
        const Services = await Service.find({deptId:deptId})
        .populate("deptId","deptName deptId")
         res.status(200).json(Services);
        
    } catch (error) {
         res.status(500).json({ error: err.message });
    }
}
module.exports = {getServicebyDepartment}
