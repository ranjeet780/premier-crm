const cron = require("node-cron");
const ServiceSubscription = require("../model/Services/ServiceSubscription");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const User = require("../model/Users/Users");
const { ALL_ROLES } = require("../utils/roles");
const { getIO } = require("../socket");

const FIXED_REMINDER_OFFSETS = [10, 5, 1];

const addDurationByRenewalType = (baseDate, durationValue, renewalType) => {
  const date = new Date(baseDate);
  const duration = Number(durationValue) || 1;

  if (renewalType === "weekly") {
    date.setDate(date.getDate() + 7 * duration);
    return date;
  }
  if (renewalType === "monthly") {
    date.setMonth(date.getMonth() + duration);
    return date;
  }
  if (renewalType === "quarterly") {
    date.setMonth(date.getMonth() + 3 * duration);
    return date;
  }
  if (renewalType === "half-yearly") {
    date.setMonth(date.getMonth() + 6 * duration);
    return date;
  }
  if (renewalType === "yearly") {
    date.setFullYear(date.getFullYear() + duration);
    return date;
  }

  date.setMonth(date.getMonth() + duration);
  return date;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const runServiceReminderJob = async () => {
  try {
    const subscriptions = await ServiceSubscription.find().populate(
      "service_id",
      "serviceName serviceId"
    );
    if (!subscriptions.length) return;

    const systemUser = (await User.findOne({ role: "superadmin" }).select("_id")) || (await User.findOne().select("_id"));
    if (!systemUser) return;

    const io = getIO();
    const today = startOfDay(new Date());

    for (const sub of subscriptions) {
      if (!sub.next_billing_date || !sub.renewal_type || !sub.duration_value) {
        continue;
      }

      let nextBillingDate = new Date(sub.next_billing_date);
      let shouldSave = false;

      while (nextBillingDate <= today) {
        nextBillingDate = addDurationByRenewalType(
          nextBillingDate,
          sub.duration_value,
          sub.renewal_type
        );
        sub.last_reminder_for = null;
        sub.reminder_offsets_sent = [];
        shouldSave = true;
      }

      if (shouldSave) {
        sub.next_billing_date = nextBillingDate;
      }

      const sentOffsets = Array.isArray(sub.reminder_offsets_sent)
        ? sub.reminder_offsets_sent.filter((value) => Number.isInteger(value))
        : [];

      for (const offset of FIXED_REMINDER_OFFSETS) {
        if (sentOffsets.includes(offset)) continue;

        const reminderDate = new Date(nextBillingDate);
        reminderDate.setDate(reminderDate.getDate() - offset);

        if (sameDay(today, reminderDate)) {
          const serviceLabel =
            sub.service_name ||
            sub.service_id?.serviceName ||
            sub.service_id?.serviceId ||
            "Service";

          const notification = await NotificationForAll.create({
            type: "SERVICE_RENEWAL_REMINDER",
            title: "Subscription Renewal Reminder",
            message: `${serviceLabel} renews on ${new Date(nextBillingDate).toLocaleDateString("en-IN")} (${offset} day(s) left).`,
            module: "service",
            refId: sub.service_id?._id || sub.service_id,
            createdByUser: systemUser._id,
            createdByRole: "system",
            visibleToRoles: ALL_ROLES,
          });

          ALL_ROLES.forEach((role) => {
            io.to(`role:${role}`).emit("new-notification", notification);
          });

          sentOffsets.push(offset);
          sub.reminder_offsets_sent = sentOffsets;
          sub.last_reminder_for = nextBillingDate;
          shouldSave = true;
        }
      }

      if (shouldSave) {
        await sub.save();
      }
    }
  } catch (error) {
    console.error("Service subscription reminder cron error:", error);
  }
};

// Every day at 09:00 server time.
cron.schedule("0 9 * * *", runServiceReminderJob);

// Also run once at server startup so reminders are not missed
// if the server starts after the scheduled 09:00 run.
runServiceReminderJob();

module.exports = {};
