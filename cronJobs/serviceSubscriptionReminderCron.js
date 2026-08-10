const cron = require("node-cron");
const nodemailer = require("nodemailer");
const ServiceSubscription = require("../model/Services/ServiceSubscription");
const Subscription = require("../model/Subscription/Subscription");
const ClientLead = require("../model/ClientLead/ClientLead");
const Company = require("../model/CompanyDetails/CompanyDetails");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const User = require("../model/Users/Users");
const { ALL_ROLES } = require("../utils/roles");
const { getIO } = require("../socket");

const FIXED_REMINDER_OFFSETS = [30, 15, 3, 1]; // 1 month (30 days), 15 days, 3 days, 1 day

const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendClientSubscriptionEmail = async ({
  recipientEmail,
  subscriberName,
  serviceName,
  plan,
  billingCycle,
  nextBillingDate,
  amount,
  bankDetails,
  offset,
  isTest = false,
}) => {
  try {
    const transporter = getTransporter();
    if (!transporter || !recipientEmail) return;

    const formattedDate = nextBillingDate
      ? new Date(nextBillingDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "N/A";

    const formattedAmount = Number(amount || 0).toLocaleString("en-IN");
    const durationText = offset === 30 ? "1 month (30 days)" : offset ? `${offset} day${offset > 1 ? "s" : ""}` : "soon";

    const bank = bankDetails || {};
    const bankName = bank.bankName || "PREMIER WEBTECH";
    const accountNumber = bank.accountNumber || "50200088013428";
    const ifscCode = bank.ifsc || "HDFC0000341";

    const subjectPrefix = isTest ? "[TEST] " : "";

    const mailOptions = {
      from: `"Premier Tech Support" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `${subjectPrefix}Reminder about Subscription Renewal - ${serviceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #003e6d; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #003e6d; margin: 0;">Subscription Renewal Notice</h2>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Dear <strong>${subscriberName || "Valued Client"}</strong>,</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            This is a reminder that your subscription for <strong>${serviceName}</strong> is scheduled for renewal on <strong>${formattedDate}</strong> (${isTest ? "Test Notice" : `in ${durationText}`}).
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Service Name:</strong> ${serviceName}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Plan Name:</strong> ${plan || "-"}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Billing Cycle:</strong> ${billingCycle || "-"}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Renewal Date:</strong> ${formattedDate}</p>
          </div>
          <div style="background-color: #f8fafc; border-left: 4px solid #003e6d; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #003e6d;">Bank Details for Payment:</h4>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>Bank Name:</strong> ${bankName}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>Account Number:</strong> ${accountNumber}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>IFSC:</strong> ${ifscCode}</p>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            Please contact us or initiate payment promptly to ensure uninterrupted service operations.
          </p>
          <p style="font-size: 14px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Best regards,<br>
            <strong>Premier Tech Team</strong>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Subscription Reminder Email Sent] to ${recipientEmail} for service: ${serviceName}`);
  } catch (err) {
    console.error(`[Subscription Reminder Email Error] Failed sending to ${recipientEmail}:`, err.message);
  }
};

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

    const systemUser =
      (await User.findOne({ role: "superadmin" }).select("_id")) ||
      (await User.findOne().select("_id"));
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

        if (reminderDate < today) {
          sentOffsets.push(offset);
          sub.reminder_offsets_sent = sentOffsets;
          shouldSave = true;
          continue;
        }

        if (sameDay(today, reminderDate)) {
          const serviceLabel =
            sub.service_name ||
            sub.service_id?.serviceName ||
            sub.service_id?.serviceId ||
            "Service";

          // 1. In-app notification
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

          if (io) {
            ALL_ROLES.forEach((role) => {
              io.to(`role:${role}`).emit("new-notification", notification);
            });
          }

          // 2. Email notification to Client
          const serviceId = sub.service_id?._id || sub.service_id;
          const subDoc = await Subscription.findOne({ sourceServiceId: serviceId });
          let recipientEmail = subDoc?.clientEmail ? subDoc.clientEmail.trim() : "";
          let subscriberName = subDoc?.subscriber || serviceLabel;

          if (!recipientEmail && subscriberName) {
            const clientLead = await ClientLead.findOne({
              $or: [
                { leadName: new RegExp(`^${subscriberName.trim()}$`, "i") },
                { ename: new RegExp(`^${subscriberName.trim()}$`, "i") },
              ],
            }).select("emailId email");
            if (clientLead) {
              recipientEmail = clientLead.emailId || clientLead.email || "";
            }
          }

          if (recipientEmail) {
            const companyDoc = await Company.findOne().catch(() => null);
            await sendClientSubscriptionEmail({
              recipientEmail,
              subscriberName,
              serviceName: serviceLabel,
              plan: subDoc?.plan || serviceLabel,
              billingCycle: subDoc?.billingCycle || sub.renewal_type || "Monthly",
              nextBillingDate,
              amount: subDoc?.amount || sub.amount || 0,
              bankDetails: companyDoc?.bank,
              offset,
            });
          }

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
runServiceReminderJob();

module.exports = {
  sendClientSubscriptionEmail,
  runServiceReminderJob,
};
