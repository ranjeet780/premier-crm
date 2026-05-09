const Service = require("../../model/Services/Service");
const ServiceSubscription = require("../../model/Services/ServiceSubscription");
const Subscription = require("../../model/Subscription/Subscription");
const Department = require("../../model/Department/AddDepartment");
const Project = require("../../model/Project/Projects");
const NotificationForAll = require("../../model/Notification/NotificationForAll");
const { ALL_ROLES } = require("../../utils/roles");
const { getIO } = require("../../socket");
const createRoleBasedNotification = require("../../utils/createRoleBasedNotification");

const VALID_RENEWAL_TYPES = [
  "weekly",
  "monthly",
  "quarterly",
  "half-yearly",
  "yearly",
];

const normalizeRenewalType = (value = "") => {
  const normalized = String(value).trim().toLowerCase().replace("_", "-");
  if (normalized === "half yearly") return "half-yearly";
  return normalized;
};

const toLegacyBillingCycle = (renewalType) => {
  if (renewalType === "monthly") return "Monthly";
  if (renewalType === "quarterly") return "Quarterly";
  if (renewalType === "yearly") return "Yearly";
  return undefined;
};

const addDurationByRenewalType = (baseDate, durationValue, renewalType) => {
  const date = new Date(baseDate);

  if (renewalType === "weekly") {
    date.setDate(date.getDate() + 7 * durationValue);
    return date;
  }

  if (renewalType === "monthly") {
    date.setMonth(date.getMonth() + durationValue);
    return date;
  }

  if (renewalType === "quarterly") {
    date.setMonth(date.getMonth() + 3 * durationValue);
    return date;
  }

  if (renewalType === "half-yearly") {
    date.setMonth(date.getMonth() + 6 * durationValue);
    return date;
  }

  if (renewalType === "yearly") {
    date.setFullYear(date.getFullYear() + durationValue);
    return date;
  }

  return date;
};

const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(raw)) {
    const isoDate = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(isoDate.getTime()) ? null : isoDate;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const validateSubscriptionInput = ({
  serviceName,
  amount,
  startDate,
  duration,
  renewalType,
  reminderDaysBefore,
}) => {
  if (!String(serviceName || "").trim()) return "Service name is required";

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return "Amount must be a positive number";
  }

  if (!startDate) return "Start date is required";
  const parsedStart = new Date(startDate);
  if (Number.isNaN(parsedStart.getTime())) return "Start date is invalid";

  const parsedDuration = Number(duration);
  if (
    !Number.isInteger(parsedDuration) ||
    parsedDuration <= 0
  ) {
    return "Duration must be a positive whole number";
  }

  const normalizedRenewalType = normalizeRenewalType(renewalType);
  if (!VALID_RENEWAL_TYPES.includes(normalizedRenewalType)) {
    return "Renewal type is invalid";
  }

  const parsedReminderDaysBefore = Number(reminderDaysBefore);
  if (!Number.isInteger(parsedReminderDaysBefore) || parsedReminderDaysBefore < 0) {
    return "Reminder days must be a non-negative whole number";
  }

  return null;
};

const upsertServiceSubscription = async ({
  serviceId,
  serviceName,
  amount,
  startDate,
  duration,
  renewalType,
  reminderDaysBefore,
}) => {
  const normalizedRenewalType = normalizeRenewalType(renewalType);
  const parsedStart = new Date(startDate);
  const parsedDuration = Number(duration);
  const parsedReminderDaysBefore = Number(reminderDaysBefore);

  const nextBillingDate = addDurationByRenewalType(
    parsedStart,
    parsedDuration,
    normalizedRenewalType
  );

  return ServiceSubscription.findOneAndUpdate(
    { service_id: serviceId },
    {
      service_id: serviceId,
      service_name: String(serviceName || "").trim(),
      amount: Number(amount),
      start_date: parsedStart,
      duration_value: parsedDuration,
      renewal_type: normalizedRenewalType,
      billing_cycle: toLegacyBillingCycle(normalizedRenewalType),
      next_billing_date: nextBillingDate,
      reminder_days_before: parsedReminderDaysBefore,
      last_reminder_for: null,
      reminder_offsets_sent: [],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const syncSubscriptionDashboardEntry = async ({
  sourceServiceId,
  serviceName,
  amount,
  startDate,
  duration,
  renewalType,
  subscriber,
  plan,
  billingCycle,
  paymentMethod,
  billToAddress,
  createdDate,
  expiringOn,
}) => {
  const normalizedRenewalType = normalizeRenewalType(renewalType || "monthly");
  const parsedDuration = Number(duration);
  const safeDuration = Number.isInteger(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;
  const parsedStartDate = parseDateValue(startDate) || new Date();
  const nextBillingDate = addDurationByRenewalType(parsedStartDate, safeDuration, normalizedRenewalType);

  const parsedCreatedDate = parseDateValue(createdDate) || parsedStartDate;
  const parsedExpiringOn = parseDateValue(expiringOn) || nextBillingDate;
  const safeServiceName = String(serviceName || "").trim() || "Service Subscription";
  const safeAmount = Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : 0;

  return Subscription.findOneAndUpdate(
    { sourceServiceId },
    {
      sourceServiceId,
      subscriber: String(subscriber || safeServiceName).trim(),
      plan: String(plan || safeServiceName).trim(),
      billingCycle: String(
        billingCycle || toLegacyBillingCycle(normalizedRenewalType) || normalizedRenewalType
      ).trim(),
      paymentMethod: String(paymentMethod || "Cash").trim(),
      billToAddress: String(billToAddress || "").trim(),
      amount: safeAmount,
      createdDate: parsedCreatedDate,
      expiringOn: parsedExpiringOn,
      status: "Unpaid",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const addService = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      serviceName,
      servicePrice,
      deptId,
      is_recurring,
      subscriber,
      plan,
      billingCycle,
      paymentMethod,
      billToAddress,
      createdDate,
      expiringOn,
      startDate,
      duration,
      renewalType,
      reminderDaysBefore = 3,
    } = req.body;

    if (!serviceName || !deptId || !servicePrice) {
      return res.status(400).json({
        success: false,
        message: "Service name, amount and department are required",
      });
    }

    if (!Number.isFinite(Number(servicePrice)) || Number(servicePrice) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Service amount must be a positive number",
      });
    }

    const department = await Department.findById(deptId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const existingService = await Service.findOne({
      serviceName: { $regex: new RegExp(`^${String(serviceName).trim()}$`, "i") },
      deptId,
    });

    if (existingService) {
      return res.status(400).json({
        success: false,
        message: `Service "${serviceName}" already exists under department "${department.deptName}".`,
      });
    }

    if (is_recurring) {
      const subscriptionValidationError = validateSubscriptionInput({
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        reminderDaysBefore,
      });

      if (subscriptionValidationError) {
        return res.status(400).json({
          success: false,
          message: subscriptionValidationError,
        });
      }

      if (
        !String(subscriber || "").trim() ||
        !String(plan || "").trim() ||
        !String(billingCycle || "").trim() ||
        !String(paymentMethod || "").trim() ||
        !createdDate ||
        !expiringOn
      ) {
        return res.status(400).json({
          success: false,
          message:
            "subscriber, plan, billingCycle, paymentMethod, createdDate and expiringOn are required for recurring service",
        });
      }

      const parsedCreatedDate = parseDateValue(createdDate);
      const parsedExpiringOn = parseDateValue(expiringOn);
      if (!parsedCreatedDate || !parsedExpiringOn) {
        return res.status(400).json({
          success: false,
          message: "Invalid createdDate or expiringOn format",
        });
      }
    }

    let subscriptionDashboardSaved = false;

    const newService = new Service({
      serviceName: String(serviceName).trim(),
      servicePrice: Number(servicePrice),
      deptId,
      is_recurring: !!is_recurring,
    });

    const savedService = await newService.save();

    if (is_recurring) {
      await upsertServiceSubscription({
        serviceId: savedService._id,
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        reminderDaysBefore,
      });

      await syncSubscriptionDashboardEntry({
        sourceServiceId: savedService._id,
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        subscriber,
        plan,
        billingCycle,
        paymentMethod,
        billToAddress,
        createdDate,
        expiringOn,
      });
      subscriptionDashboardSaved = true;
    }

    await createRoleBasedNotification({
      type: "SERVICE_CREATED",
      title: "New Service Added",
      message: `Service "${serviceName}" was added under "${department.deptName}" by ${req.user.role}`,
      module: "service",
      refId: savedService._id,
      actorUserId: req.user.id,
      actorRole: req.user.role.toLowerCase(),
    });

    res.status(201).json({
      success: true,
      message: "Service added successfully",
      data: savedService,
      subscriptionDashboardSaved,
    });
  } catch (error) {
    console.error("Error adding service:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getServicesByDept = async (req, res) => {
  try {
    const { deptId } = req.params;
    const services = await Service.find({ deptId }).populate("deptId", "deptName deptId servicePrice");
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllServices = async (_req, res) => {
  try {
    const services = await Service.find().populate("deptId", "deptName deptId servicePrice");
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getServicebyId = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate("deptId", "deptName deptId");
    if (!service) return res.status(404).json({ message: "Service not found" });

    let subscription = null;
    if (service.is_recurring) {
      subscription = await ServiceSubscription.findOne({ service_id: service._id });
    }

    res.json({
      ...service.toObject(),
      subscription,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllServiceSubscriptions = async (_req, res) => {
  try {
    const subscriptions = await ServiceSubscription.find()
      .populate({
        path: "service_id",
        select: "serviceName serviceId deptId is_recurring",
        populate: { path: "deptId", select: "deptName deptId" },
      })
      .sort({ createdAt: -1 });
    res.status(200).json(subscriptions);
  } catch (err) {
    console.error("Get Service Subscriptions Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateServiceSubscription = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      serviceName,
      amount,
      startDate,
      duration,
      renewalType,
      reminderDaysBefore = 3,
    } = req.body;

    const existingSubscription = await ServiceSubscription.findById(id);
    if (!existingSubscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const validationError = validateSubscriptionInput({
      serviceName,
      amount,
      startDate,
      duration,
      renewalType,
      reminderDaysBefore,
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const service = await Service.findById(existingSubscription.service_id);
    if (!service) {
      return res.status(404).json({ message: "Related service not found" });
    }

    service.serviceName = String(serviceName).trim();
    service.servicePrice = Number(amount);
    service.is_recurring = true;
    await service.save();

    const updatedSubscription = await upsertServiceSubscription({
      serviceId: service._id,
      serviceName,
      amount,
      startDate,
      duration,
      renewalType,
      reminderDaysBefore,
    });

    await syncSubscriptionDashboardEntry({
      sourceServiceId: service._id,
      serviceName,
      amount,
      startDate,
      duration,
      renewalType,
    });

    await createRoleBasedNotification({
      type: "SERVICE_SUBSCRIPTION_UPDATED",
      title: "Subscription Updated",
      message: `Subscription for "${service.serviceName}" was updated by ${req.user.role}`,
      module: "service",
      refId: service._id,
      actorUserId: req.user.id,
      actorRole: req.user.role.toLowerCase(),
    });

    res.status(200).json({
      message: "Subscription updated successfully",
      data: updatedSubscription,
    });
  } catch (err) {
    console.error("Update Service Subscription Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const deleteServiceSubscription = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const subscription = await ServiceSubscription.findByIdAndDelete(id);

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    await Service.findByIdAndUpdate(subscription.service_id, { is_recurring: false });
    await Subscription.findOneAndDelete({ sourceServiceId: subscription.service_id });

    await createRoleBasedNotification({
      type: "SERVICE_SUBSCRIPTION_DELETED",
      title: "Subscription Deleted",
      message: `A service subscription was removed by ${req.user.role}`,
      module: "service",
      refId: subscription.service_id,
      actorUserId: req.user.id,
      actorRole: req.user.role.toLowerCase(),
    });

    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (err) {
    console.error("Delete Service Subscription Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const sendTestServiceReminder = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const subscription = await ServiceSubscription.findById(id).populate(
      "service_id",
      "serviceName"
    );

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const serviceLabel =
      subscription.service_name ||
      subscription.service_id?.serviceName ||
      "Service";

    const notification = await NotificationForAll.create({
      type: "SERVICE_RENEWAL_REMINDER_TEST",
      title: "Test Subscription Reminder",
      message: `[TEST] ${serviceLabel} renews on ${new Date(subscription.next_billing_date).toLocaleDateString("en-IN")}.`,
      module: "service",
      refId: subscription.service_id?._id || subscription.service_id,
      createdByUser: req.user._id,
      createdByRole: String(req.user.role || "").toLowerCase() || "admin",
      visibleToRoles: ALL_ROLES,
    });

    // Keep test reminder usable even if socket layer is not available yet.
    try {
      const io = getIO();
      ALL_ROLES.forEach((role) => {
        io.to(`role:${role}`).emit("new-notification", notification);
      });
    } catch (socketError) {
      console.warn("Socket not initialized for test reminder emit:", socketError.message);
    }

    return res.status(200).json({
      message: "Test reminder sent successfully",
      data: notification,
    });
  } catch (err) {
    console.error("Send Test Service Reminder Error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const deleteService = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    await ServiceSubscription.findOneAndDelete({ service_id: id });
    await Subscription.findOneAndDelete({ sourceServiceId: id });
    const deletedService = await Service.findByIdAndDelete(id);

    if (!deletedService) {
      return res.status(404).json({ message: "Service not found" });
    }

    await createRoleBasedNotification({
      type: "SERVICE_DELETED",
      title: "Service Deleted",
      message: `Service "${deletedService.serviceName}" was deleted by ${req.user.role}`,
      module: "service",
      refId: deletedService._id,
      actorUserId: req.user.id,
      actorRole: req.user.role.toLowerCase(),
    });

    res.json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("Delete Service Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateService = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      serviceName,
      servicePrice,
      deptId,
      is_recurring,
      subscriber,
      plan,
      billingCycle,
      paymentMethod,
      billToAddress,
      createdDate,
      expiringOn,
      startDate,
      duration,
      renewalType,
      reminderDaysBefore = 3,
    } = req.body;

    if (!serviceName || !servicePrice || !deptId) {
      return res.status(400).json({ message: "Service name, amount and department are required" });
    }

    if (!Number.isFinite(Number(servicePrice)) || Number(servicePrice) <= 0) {
      return res.status(400).json({ message: "Service amount must be a positive number" });
    }

    if (is_recurring) {
      const validationError = validateSubscriptionInput({
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        reminderDaysBefore,
      });

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
    }

    const updatedService = await Service.findByIdAndUpdate(
      id,
      {
        serviceName: String(serviceName).trim(),
        servicePrice: Number(servicePrice),
        deptId,
        is_recurring: !!is_recurring,
      },
      { new: true, runValidators: true }
    );

    if (!updatedService) {
      return res.status(404).json({ message: "Service not found" });
    }

    if (is_recurring) {
      await upsertServiceSubscription({
        serviceId: id,
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        reminderDaysBefore,
      });
      await syncSubscriptionDashboardEntry({
        sourceServiceId: id,
        serviceName,
        amount: servicePrice,
        startDate,
        duration,
        renewalType,
        subscriber,
        plan,
        billingCycle,
        paymentMethod,
        billToAddress,
        createdDate,
        expiringOn,
      });
    } else {
      await ServiceSubscription.findOneAndDelete({ service_id: id });
      await Subscription.findOneAndDelete({ sourceServiceId: id });
    }

    await createRoleBasedNotification({
      type: "SERVICE_UPDATED",
      title: "Service Updated",
      message: `Service "${serviceName}" was updated by ${req.user.role}`,
      module: "service",
      refId: updatedService._id,
      actorUserId: req.user.id,
      actorRole: req.user.role.toLowerCase(),
    });

    res.json({
      message: "Service updated successfully",
      data: updatedService,
    });
  } catch (err) {
    console.error("Update Service Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const getServiceByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).populate("service", "serviceName");
    if (!project) return res.status(404).json({ message: "Project not found" });

    res.status(200).json({
      message: "Services fetched successfully",
      services: [project.service],
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  addService,
  getServicesByDept,
  getAllServices,
  deleteService,
  updateService,
  getServicebyId,
  getServiceByProject,
  getAllServiceSubscriptions,
  updateServiceSubscription,
  deleteServiceSubscription,
  sendTestServiceReminder,
};
