
const express = require("express");
const uploadTo = require("../controller/middleware/multer");
const multer = require("multer");

const commentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/comments/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const uploadComment = multer({ storage: commentStorage });


const { SignUpController, getEmployeesByService } = require("../controller/SignUp/SignUp");
const { LoginAdmin } = require("../controller/Login/Login");
const { getEmployeeData } = require("../controller/Employee/getEmployee");
const { addDepartment, getDepartments, updateDepartment, getDepartmentByid, deleteDepartment } = require("../controller/DepartmentName/DepartmentName");
const { Job_Opening, get_JobOpening, DeleteJob, uploadJobResume } = require("../controller/Job_Opening/JobOpening");
const { job_data } = require("../Update_job_no/Update_job_no");
const { getTraineeData } = require("../controller/Employee/getTraniee");
const { updateUser, deleteUser } = require("../controller/SignUp/SignUpDelandUpdate");
const { UpdateType, getAllEmployees, deleteEmployee, toggleEmployeeBlock } = require("../controller/SignUp/UpdateUserType");
const { Get_ClientLead, Gen_ClientLead, deleteLead, getLeadById, sendPasswordSetupOtp, createPassword, clientLogin } = require("../controller/ClientLead/ClientLeadData");
const { Get_Lead, Get_Client, getClientLeadById } = require("../controller/ClientLead/getClient");
const { updateVacancy, selectResumeForJob, unselectResumeForJob, blockResumeForJob, unblockResumeForJob } = require("../controller/Job_Opening/UpdateJob");
const { getEmpdatabyID, getEmployeesByDepartment } = require("../controller/Employee/getEmpbyId");
const { ConvertToClient, updateStatus } = require("../controller/ClientLead/ConverttoClient");
const { updateClientUser, deleteClientUser } = require("../controller/ClientLead/UpdateClientLead");
const { getMonthlyAttendance, getTodayAttendance, markAttendanceCheckOut, getMonthlyAttendanceByAdmin, adminUpdateOfficeTiming, startBreak, resumeBreak } = require("../controller/Attendance/Attendance");
const { markAttendance } = require("../controller/Attendance/markAttendanceController");
const { UserLogin, UserLogout, getWorkingHours, forgotPassword, resetUserPassword, lockUserByInactivity, getLockedStatus, generateManualCode } = require("../controller/UserLogin/UserLogin");
const { markAttendanceOnLogin } = require("../controller/UserLogin/attendanceService");
const { add_leave, get_leaves, getLeaves } = require("../controller/User/Leave/Leave");
const {
  addService,
  getAllServices,
  getServicesByDept,
  deleteService,
  updateService,
  getServicebyId,
  getServiceByProject,
  getAllServiceSubscriptions,
  updateServiceSubscription,
  deleteServiceSubscription,
  sendTestServiceReminder,
} = require("../controller/Service/Service");
const { createProject, getProject, getProjectById, getProjectsByClient, getProjectByProjectId, updateProject, deleteProject, getServicebyProjectId, getAssignEmpByService, getEmployeesByProjectId, getProjectDetailById } = require("../controller/Projects/Projects");
const { getServicebyDepartment } = require("../controller/DepartmentServiceAPI/getDepartmentService");
const { createAndSendProposal, upload, getAllProposals, updateProposal, getProposalById, deleteProposal, approveProposal, analyzeProposal } = require("../controller/Purposal/Purposal");

const { notifyTask } = require("../controller/Notification/NotifyTask");
const { sendNotification, getNotifications, markAsRead, getAllNotifications, deleteNotice, updateNoticeMeta } = require("../controller/Notification/Notification");
const router = require("./Roles");
const { updateCompany, createCompany, getCompany } = require("../controller/CompanyDetails/CompanyDetails");
const { createDomain, getDomains, updateDomainStatus, deleteDomain } = require("../controller/Domain/Domain");
const {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
  addSubscriptionPayment,
  deleteSubscription,
  updateSubscriptionAddress,
  updateSubscriptionCurrency,
  uploadSignatureMiddleware,
  uploadSubscriptionSignature,
  removeSubscriptionSignature,
  downloadSubscriptionPdf,
} = require("../controller/Subscription/Subscription");

// const { createInvoice, markInvoicePaid } = require("../controller/Payment/PaymentController");


const { getAllInvoices, getInvoiceById, deleteInvoice, createInvoice, markInvoicePaid, getInvoicesByClient, addPayment, getSingleInvoice, updateInvoice, sendInvoice, verifyPayment } = require('../controller/Invoice/Invoice');
const { getReportsSummary } = require("../controller/Reports/Reports");
const { getAdminSummary } = require("../controller/Summary/Summary");
const { getAllLeaves, getMonthlyAcceptedLeaves, addLeave, updateLeaveStatus, getAllLeavesAdmin } = require("../controller/UserPannel/Leaves/Leaves");

const { getTasksByEmployee } = require("../controller/User/TaskAssign/TaskAssign");
const { getEmployeeStats } = require("../model/userPannel/HomePage/HomePage");
const { updateSelfProfile, getEmployeeById } = require("../controller/SignUp/UpdateEmplyeeSelf");
// const { registerUser, loginUser, getAllUsers } = require("../controller/authController/authController");
// const { createUser } = require("../controller/userController/userController");
const { requireSuperAdmin } = require("../controller/middleware/auth");
const jwt = require('jsonwebtoken');
const User = require('../model/Users/Users');
const SignUp = require('../model/SignUp/SignUp');
const { createUser, updatePermission, getAllAdminUsers, getAdminUserById, deleteAdminUserById, resetPassword, } = require("../controller/userController/userController");
const normalizeInput = require("../controller/middleware/normalizeInput");
const { getModules } = require("../controller/Module/modules");


const taskRoutes = require("./Task/taskRoutes");
const { getClientDashboardSummary } = require("../controller/clientDashboard/clientHome/clientSummary");
const { getClientProjects, getClientProject, getClientProposals, getClientProposal, getClientProfile, updateClientProfile, getClientTasks, getClientTask } = require("../controller/clientDashboard/clientHome/clientDashboardExtras");
const { createHoliday, getAllHolidays, deleteHoliday, isHoliday } = require("../controller/Holiday/holidayController");

const { getEmployeeProjectList, getEmployeeTasks, getTaskDetails, getEmployeeTask } = require("../controller/Task/employeeTask");




//salary
const { getSalaryStats, getSalaryDetails } = require("../controller/User/Salary/Salary");
const { getSalaryByMonth, generateSalary, regenSalary, getSalaryHistory, requestAccess, approveAccess, getAllSalaries, regenerateSalary, markSalaryPaid, getAllEmployeesWithSalary, adminGetAllSalary, getAllEmployeeSalary } = require('../controller/UserPannel/salary/salary');
const { getJobOpeningNotifications, markAsReadJobOpeningNotification } = require("../controller/Notification/JobOpeningNotification");
const { getEmployeeNotifications, markAllEmployeeNotificationsAsRead } = require("../controller/Notification/employeeNotificationController");
const authMiddleware = require("../controller/middleware/authMiddleware");
const { getEmployeesByServiceTask, getEmployeesByServiceInTask } = require("../controller/Task/Task");
// const {  markNotificationRead, getEmployeeNotifications } = require("../controller/Notification/getEmployeeNotification");

const { createBankAccount, getBankAccounts, deleteBankAccount, updateBankAccount } = require("../controller/BankAccountController");
const { createCategory, getCategories, deleteCategory } = require("../controller/ExpenseCategoryController");
const { createExpense, getExpenses, deleteExpense, updateExpense } = require("../controller/ExpenseController");
const { createIncome, getIncomes, deleteIncome } = require("../controller/IncomeController");


const Router = express.Router();

// ---------- FILE UPLOAD ROUTES ----------
Router.post(
  "/signUp", authMiddleware,
  uploadTo().fields([
    { name: "resumeFile", maxCount: 1 },
    { name: "img", maxCount: 1 },
    { name: "aadhaarFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
  ]),
  SignUpController
);


Router.put("/updateSelfId/:id", uploadTo().fields([
  { name: "img", maxCount: 1 },
  { name: "resumeFile", maxCount: 1 },
  { name: "aadhaarFile", maxCount: 1 },
  { name: "panFile", maxCount: 1 },
]), updateSelfProfile
)


Router.get('/getAllEmployees', getAllEmployees)
Router.delete('/deleteEmp/:id', deleteEmployee)
Router.post("/proposals", upload.array("attachments"), createAndSendProposal);
Router.post("/proposals/analyze", analyzeProposal);
Router.put('/UpdateProposal/:id', upload.array("attachments"), updateProposal)
Router.delete('/DeleteProposal/:id', deleteProposal)
Router.get('/getProposalById/:id', getProposalById)

Router.get('/getAllProposal', getAllProposals)


Router.post("/addProject", uploadTo().single("addFile"), createProject);

Router.put(
  "/updateSignUser/:employeeId", authMiddleware,
  uploadTo().fields([
    { name: "resumeFile", maxCount: 1 },
    { name: "img", maxCount: 1 },
    { name: "aadhaarFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
  ]),
  updateUser
)


Router.get("/getEmplyeeById/:id", getEmployeeById)
//Reports
Router.get('/reports/summary', getReportsSummary)

//Invoice Routes
Router.get('/getAllInvoices', getAllInvoices);
Router.get('/getInvoiceById/:id', getInvoiceById);
Router.get('/getSingleInvoice/:id', getSingleInvoice);
Router.put('/markpaid/:id', markInvoicePaid);
Router.put('/updateInvoice/:id', updateInvoice);
Router.get('/getInvoicesByClient/:clientId', getInvoicesByClient)
Router.delete('/deleteInvoice/:id', deleteInvoice)
Router.post('/invoices/:id/addPayment', addPayment)
Router.post('/sendInvoice/:id', sendInvoice)
Router.post('/verifyPayment', verifyPayment)

Router.patch('/approvalproposal/:id', approveProposal)


Router.post("/createInvoice", createInvoice);

Router.get('/AdminSummary/', getAdminSummary)



Router.get("/getEmployeeByService/:serviceId", getEmployeesByService);
Router.post("/adminLogin", normalizeInput, LoginAdmin);
Router.get('/users/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;

    const adminUser = await User.findById(userId).lean();
    if (adminUser) {
      return res.json({ user: adminUser });
    }

    const employee = await SignUp.findById(userId).lean();
    if (employee) {
      return res.json({
        user: {
          _id: employee._id,
          name: employee.ename || "Employee",
          role: employee.role || "employee",
          userType: employee.userType || "employee",
          screenshotInterval: employee.screenshotInterval || 300,
          inactivityTimeout: employee.inactivityTimeout || 300,
          email: employee.official_email || "",
          permissions: {},
        },
      });
    }

    return res.status(404).json({ message: "User not found" });
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
});

//create user by admin routes
Router.post('/users/create', normalizeInput, createUser)
Router.put('/users/update/:id', updatePermission)
Router.get('/getAllAdminUser', getAllAdminUsers)
Router.get('/getAdminbyUsers/:id', getAdminUserById)
Router.delete('/deleteAdminByUser/:id', deleteAdminUserById)
Router.put('/users/:id', resetPassword)

//permission
Router.get('/getModule', getModules)
Router.use('/roles', router)


//login  and logout employee page
// Router.post('/employee/login',UserLogin)
Router.post('/employee/logout', UserLogout)
Router.get('/employee/working-hours', getWorkingHours)

Router.get("/getemployeeData", getEmployeeData);

// Employee Notification Routes
Router.get("/notifications/employee/:employeeId", getEmployeeNotifications);
Router.put("/notifications/employee/readAll/:employeeId", markAllEmployeeNotificationsAsRead);
Router.post("/addDepartment", addDepartment);
Router.get("/getDepartment", getDepartments);
Router.get('/getEmployeeByDepartment/:deptId', getEmployeesByDepartment)
Router.get("/getServicebyDepartment/:deptId", getServicebyDepartment);

Router.get('/getEmployeesByService/:serviceId', getEmployeesByServiceInTask)


Router.post("/addJob", authMiddleware, Job_Opening);
Router.put("/uploadJobResume/:id", authMiddleware, uploadTo().single("resumeFile"), uploadJobResume);
Router.delete('/deleteJob/:id', authMiddleware, DeleteJob)
Router.get("/get_Jobs", get_JobOpening);
Router.put('/updateDepartment/:id', authMiddleware, updateDepartment)
Router.delete('/deleteDepartment/:id', authMiddleware, deleteDepartment)
Router.get('/getDepartmentById/:id', getDepartmentByid)
Router.post("/addService", authMiddleware, addService);
Router.get("/getServices", getAllServices);
Router.get('/getServiceById/:id', getServicebyId)
Router.get('/serviceSubscriptions', getAllServiceSubscriptions)
Router.put('/serviceSubscriptions/:id', authMiddleware, updateServiceSubscription)
Router.delete('/serviceSubscriptions/:id', authMiddleware, deleteServiceSubscription)
Router.post('/serviceSubscriptions/:id/test-reminder', authMiddleware, sendTestServiceReminder)
Router.get("/serviceById/:deptId", getServicesByDept);
Router.delete('/deleteService/:id', authMiddleware, deleteService)
Router.put('/UpdateService/:id', authMiddleware, updateService)
Router.get("/getProjects", getProject);
Router.put('/updateProject/:id', updateProject)
Router.get("/getProjectById/:clientId/:projectId", getProjectById);
Router.delete('/deleteProjectById/:id', deleteProject)
// Router.post("/createInvoice/:clientId", createInvoice);
Router.post("/markAttendance", markAttendance);
Router.get("/getProjectbyClient/:clientId", getProjectsByClient);
Router.get('/getprojectByPorjectId/:projectId', getProjectByProjectId)
Router.get("/getjobvacancy", job_data);

//Task api


Router.get('/getTraineeData', getTraineeData)
Router.delete("/deleteSignUpUser/:employeeId", authMiddleware, deleteUser);
Router.put("/toggleEmployeeBlock/:id", authMiddleware, toggleEmployeeBlock);
Router.put("/movetoemployee/:employeeId", UpdateType);
Router.post("/genClientLead", authMiddleware, Gen_ClientLead);
Router.get("/getClientLead", Get_ClientLead);
Router.get('/employeeListProject', getEmployeeProjectList)
Router.get('/tasks/employee/:employeeId', getEmployeeTasks)
Router.get('/details/:taskId', getTaskDetails)
Router.get('/getEmplyeeTask/:employeeId', getEmployeeTask)


//Notification
Router.post('/notifyTask', notifyTask)

//notification 

Router.post('/sendNotification', sendNotification)
Router.put('/read/:notificationId', markAsRead)
Router.get('/notifications/admin', getAllNotifications)
Router.put('/notifications/mark-read/:notificationId', markAsRead)
Router.get('/getAllNotifications', getAllNotifications)
Router.delete('/deleteNotice/:id', deleteNotice)
Router.patch('/updateNoticeMeta/:id', updateNoticeMeta)


Router.get('/getServices/:projectId', getServiceByProject)
Router.get('/getProjectDetails/:projectId', getProjectDetailById);

Router.get('/getEmployeeByProject/:projectId', getEmployeesByProjectId)

Router.get('/leadById/:id', getLeadById)

Router.put('/updateStatus/:id', updateStatus)

//permission


//company details 

Router.post('/companyDetails', createCompany)
Router.get('/getCompnayDetails', getCompany)
Router.put('/updateCompnay/:id', updateCompany)
Router.post('/domains', createDomain)
Router.get('/domains', getDomains)
Router.put('/domains/:id/status', updateDomainStatus)
Router.delete('/domains/:id', deleteDomain)
Router.post('/subscriptions', createSubscription)
Router.get('/subscriptions', getSubscriptions)
Router.get('/subscriptions/:id', getSubscriptionById)
Router.put('/subscriptions/:id/status', updateSubscriptionStatus)
Router.post('/subscriptions/:id/addPayment', addSubscriptionPayment)
Router.put('/subscriptions/:id/address', updateSubscriptionAddress)
Router.put('/subscriptions/:id/currency', updateSubscriptionCurrency)
Router.put('/subscriptions/:id/signature', uploadSignatureMiddleware, uploadSubscriptionSignature)
Router.post('/subscriptions/:id/signature', uploadSignatureMiddleware, uploadSubscriptionSignature)
Router.delete('/subscriptions/:id/signature', removeSubscriptionSignature)
Router.get('/subscriptions/:id/pdf', downloadSubscriptionPdf)
Router.delete('/subscriptions/:id', deleteSubscription)


Router.get("/getLeadData", Get_Lead);
Router.get("/getClientData", Get_Client);

Router.put("/updateVacancy/:jobId", updateVacancy);
Router.put("/selectResumeForJob/:jobId", selectResumeForJob);
Router.put("/unselectResumeForJob/:jobId", unselectResumeForJob);
Router.put("/blockResumeForJob/:jobId", blockResumeForJob);
Router.put("/unblockResumeForJob/:jobId", unblockResumeForJob);

Router.get("/getEmpDataByID/:employeeId", getEmpdatabyID);
Router.get("/getSignUserById/:employeeId", getEmpdatabyID);

//client routes
Router.put("/moveleadtoClient/:leadId", ConvertToClient);
Router.delete("/DeleteLead/:leadId", deleteLead);
Router.put("/updateClientLead/:leadId", authMiddleware, updateClientUser);
Router.delete("/deleteClientLead/:leadId", deleteClientUser);
Router.get("/getClientLeadbyId/:leadId", getClientLeadById);
Router.post('/client/send-password-otp', sendPasswordSetupOtp);
Router.post('/client/create-password', createPassword)
Router.post('/clientLogin', clientLogin)


//leaves routes wor
Router.post('/addLeave', addLeave)

Router.get('/getLeave', getLeaves)
Router.get('/getAllLeaves/:employeeId', getAllLeaves)
Router.get('/admin/getAllLeave', getAllLeavesAdmin)

Router.put('/admin/updateLeaveStatus/:leaveId', updateLeaveStatus)




Router.post("/userLogin", UserLogin);

Router.get('/getTasksByEmployee/:employeeId', getTasksByEmployee)

Router.post("/lock-inactivity", lockUserByInactivity);
Router.get("/locked-status", getLockedStatus);
Router.post("/generate-code", generateManualCode);

Router.get('/employeeStats/:employeeId', getEmployeeStats)

//forget password 
Router.post("/forget-password", forgotPassword)

Router.post("/reset-password/:token", resetUserPassword)


//attandance
Router.get('/monthly', getMonthlyAttendance)
Router.get('/today', getTodayAttendance)
Router.get('/employee/IsHoliday', isHoliday)



Router.post("/checkout", markAttendanceCheckOut);
Router.post("/break/start", startBreak);
Router.post("/break/resume", resumeBreak);
Router.get('/getMonthlyAttandenceByAdmin', getMonthlyAttendanceByAdmin)



Router.use("/tasks", taskRoutes);

//client Routes
Router.get('/client/dashboard/:clientId', getClientDashboardSummary)
Router.get('/client/client-projects/:clientId', getClientProjects)
Router.get('/client/client-project/:projectId', getClientProject)
Router.get('/client/client-proposals/:clientId', getClientProposals)
Router.get('/client/client-proposal/:proposalId', getClientProposal)

Router.get('/client/profile/:clientId', getClientProfile)
Router.put('/client/profile/:clientId', updateClientProfile)

Router.get('/client/client-tasks/:clientId', getClientTasks)
Router.get('/client/client-task/:taskId', getClientTask)


// Protect with admin middleware
Router.post('/holiday', createHoliday)
Router.get('/holiday', getAllHolidays)
Router.delete('/holiday/:id', deleteHoliday)


// Update employee office timing (admin)
// NOTE: uses the simple JWT-only auth (not authMiddleware which only looks up the User collection)
// Role enforcement is done inside adminUpdateOfficeTiming controller itself.
const simpleJwtAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
Router.put('/updateOfficeTiming/:employeeId', simpleJwtAuth, adminUpdateOfficeTiming)


//Salary api
Router.get('/month/:empId', getSalaryByMonth)
Router.post('/generateSalary/:empId', generateSalary);
Router.post('/regenSalary/:empId', regenSalary);
Router.get('/salaryhistory/:empId', getSalaryHistory)
Router.post('/salary/requestAccess', requestAccess);
Router.put('/salary/approveAccess/:requestId', approveAccess)
Router.get('/salary/all/sal', getAllSalaries);



Router.put('/salary/regen/:empId', regenerateSalary)
Router.put('/salary/update/:id', markSalaryPaid)
Router.get('/salary/employee-wise', getAllEmployeesWithSalary)
Router.get('/salary/all/getsalary', adminGetAllSalary)
Router.get('/salary/all', getAllEmployeeSalary)


//Job Opening Notification
Router.get('/getJobOpeningNotification', authMiddleware, getJobOpeningNotifications)
Router.put('/ReadJobOpeningNotification/:id', authMiddleware, markAsReadJobOpeningNotification)


// Bank Accounts
Router.post("/bank-account", createBankAccount);
Router.get("/bank-account", getBankAccounts);
Router.put("/bank-account/:id", updateBankAccount);
Router.delete("/bank-account/:id", deleteBankAccount);

// Expense Category
Router.post("/expense-category", createCategory);
Router.get("/expense-category", getCategories);
Router.delete("/expense-category/:id", deleteCategory);

// Expenses
Router.post("/expense", createExpense);
Router.get("/expense", getExpenses);
Router.put("/expense/:id", updateExpense);
Router.delete("/expense/:id", deleteExpense);

// Incomes
Router.post("/income", createIncome);
Router.get("/income", getIncomes);
Router.delete("/income/:id", deleteIncome);

module.exports = Router;
