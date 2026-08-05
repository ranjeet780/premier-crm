const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Domain = require("../model/Domain/Domain");
const ClientLead = require("../model/ClientLead/ClientLead");
const Company = require("../model/CompanyDetails/CompanyDetails");
const NotificationForAll = require("../model/Notification/NotificationForAll");
const User = require("../model/Users/Users");
const { ALL_ROLES } = require("../utils/roles");
const { getIO } = require("../socket");

const EXPIRY_REMINDER_OFFSETS = [30, 15, 3, 1]; // 1 month (30 days), 15 days, 3 days, 1 day

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

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

const sendClientExpiryEmail = async ({ recipientEmail, clientName, itemName, productType, plan, expireDate, amount, bankDetails, offset }) => {
  try {
    const transporter = getTransporter();
    if (!transporter || !recipientEmail) return;

    const typeLabel = productType ? productType.charAt(0).toUpperCase() + productType.slice(1) : "Service";
    const formattedDate = new Date(expireDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const formattedAmount = Number(amount || 0).toLocaleString("en-IN");
    const durationText = offset === 30 ? "1 month (30 days)" : `${offset} day${offset > 1 ? "s" : ""}`;

    const bank = bankDetails || {};
    const bankName = bank.bankName || "PREMIER WEBTECH";
    const accountNumber = bank.accountNumber || "50200088013428";
    const ifscCode = bank.ifsc || "HDFC0000341";

    const mailOptions = {
      from: `"Premier Tech Support" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `Reminder about AMC Renewal - ${itemName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #003e6d; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #003e6d; margin: 0;">${typeLabel} Renewal Notice</h2>
          </div>
          <p style="font-size: 16px; color: #1e293b;">Dear <strong>${clientName || "Valued Client"}</strong>,</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            This is a reminder that your <strong>${typeLabel}</strong> (<code>${itemName}</code>) is set to expire on <strong>${formattedDate}</strong> (in <strong>${durationText}</strong>).
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Service Name:</strong> ${itemName}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Service Type:</strong> ${typeLabel}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Plan:</strong> ${plan || "-"}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Renewal Amount:</strong> ₹${formattedAmount}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #0f172a;"><strong>Expiry Date:</strong> ${formattedDate}</p>
          </div>
          <div style="background-color: #f8fafc; border-left: 4px solid #003e6d; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #003e6d;">Bank Details for Payment:</h4>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>Bank Name:</strong> ${bankName}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>Account Number:</strong> ${accountNumber}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #0f172a;"><strong>IFSC:</strong> ${ifscCode}</p>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            Please contact us or initiate renewal promptly to ensure uninterrupted service operations.
          </p>
          <p style="font-size: 14px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Best regards,<br>
            <strong>Premier Tech Team</strong>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Expiry Reminder Email Sent] to ${recipientEmail} for ${typeLabel}: ${itemName}`);
  } catch (err) {
    console.error(`[Expiry Reminder Email Error] Failed sending to ${recipientEmail}:`, err.message);
  }
};

const runDomainExpiryReminderJob = async () => {
  try {
    const items = await Domain.find();
    if (!items || !items.length) return;

    const systemUser =
      (await User.findOne({ role: "superadmin" }).select("_id")) ||
      (await User.findOne().select("_id"));
    if (!systemUser) return;

    const io = getIO();
    const today = startOfDay(new Date());
    const targetRoles = Array.from(new Set([...ALL_ROLES, "employee"]));

    for (const item of items) {
      if (!item.expireDate) continue;

      const expireDate = startOfDay(item.expireDate);
      if (expireDate < today) continue;

      const sentOffsets = Array.isArray(item.reminder_offsets_sent)
        ? item.reminder_offsets_sent.filter((v) => Number.isInteger(v))
        : [];

      let shouldSave = false;

      for (const offset of EXPIRY_REMINDER_OFFSETS) {
        if (sentOffsets.includes(offset)) continue;

        const reminderDate = new Date(expireDate);
        reminderDate.setDate(reminderDate.getDate() - offset);

        if (reminderDate < today) {
          // Auto-mark past offsets as sent without firing alerts
          sentOffsets.push(offset);
          item.reminder_offsets_sent = sentOffsets;
          shouldSave = true;
          continue;
        }

        if (sameDay(today, reminderDate)) {
          const typeLabel = item.productType
            ? item.productType.charAt(0).toUpperCase() + item.productType.slice(1)
            : "Domain";

          const formattedExpiry = new Date(item.expireDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          const durationText = offset === 30 ? "1 month" : `${offset} day${offset > 1 ? "s" : ""}`;

          // 1. In-app notification to Admin, Superadmin, etc.
          const notification = await NotificationForAll.create({
            type: `${item.productType ? item.productType.toUpperCase() : "DOMAIN"}_EXPIRY_REMINDER`,
            title: `${typeLabel} Expiry Reminder`,
            message: `${item.name || "Item"} (${typeLabel}) for ${item.clientName || "Client"} expires in ${durationText} on ${formattedExpiry}.`,
            module: item.productType || "domain",
            refId: item._id,
            createdByUser: systemUser._id,
            createdByRole: "system",
            visibleToRoles: targetRoles,
          });

          targetRoles.forEach((role) => {
            if (io) {
              io.to(`role:${role}`).emit("new-notification", notification);
            }
          });

          // 2. Email notification to Client
          let recipientEmail = item.clientEmail ? item.clientEmail.trim() : "";

          // Fallback: look up client email in ClientLead database if not stored directly on domain item
          if (!recipientEmail && item.clientName) {
            const clientLead = await ClientLead.findOne({
              $or: [
                { leadName: new RegExp(`^${item.clientName.trim()}$`, "i") },
                { ename: new RegExp(`^${item.clientName.trim()}$`, "i") },
              ],
            }).select("emailId email");
            if (clientLead) {
              recipientEmail = clientLead.emailId || clientLead.email || "";
            }
          }

          if (recipientEmail) {
            const companyDoc = await Company.findOne().catch(() => null);
            await sendClientExpiryEmail({
              recipientEmail,
              clientName: item.clientName,
              itemName: item.name,
              productType: item.productType,
              plan: item.plan,
              expireDate: item.expireDate,
              amount: item.actualAmount || item.paidAmount || 0,
              bankDetails: companyDoc?.bank,
              offset,
            });
          }

          sentOffsets.push(offset);
          item.reminder_offsets_sent = sentOffsets;
          shouldSave = true;
        }
      }

      if (shouldSave) {
        await item.save().catch(() => {});
      }
    }
  } catch (error) {
    console.error("Domain/Hosting expiry reminder cron error:", error);
  }
};

// Run every day at 09:00 AM server time
cron.schedule("0 9 * * *", runDomainExpiryReminderJob);

// Run on server startup
runDomainExpiryReminderJob();

module.exports = { runDomainExpiryReminderJob };
