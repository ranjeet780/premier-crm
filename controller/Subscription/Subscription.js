const Subscription = require("../../model/Subscription/Subscription");
const ServiceSubscription = require("../../model/Services/ServiceSubscription");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const SIGNATURE_MAX_SIZE = 200 * 1024;

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SIGNATURE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only jpg, jpeg and png signature files are allowed"));
    }
    cb(null, true);
  },
}).single("signature");

const uploadSignatureMiddleware = (req, res, next) => {
  signatureUpload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Signature image size must be 200KB or less" });
    }

    return res.status(400).json({ message: err.message || "Failed to upload signature" });
  });
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

const createSubscription = async (req, res) => {
  try {
    const {
      subscriber,
      plan,
      billingCycle,
      paymentMethod,
      billToAddress,
      amount,
      createdDate,
      expiringOn,
      status,
    } = req.body;

    if (!subscriber || !plan || !billingCycle || !paymentMethod || amount === undefined || !createdDate || !expiringOn) {
      return res.status(400).json({
        message:
          "subscriber, plan, billingCycle, paymentMethod, amount, createdDate and expiringOn are required",
      });
    }

    const parsedCreatedDate = parseDateValue(createdDate);
    const parsedExpiringOn = parseDateValue(expiringOn);

    if (!parsedCreatedDate || !parsedExpiringOn) {
      return res.status(400).json({ message: "Invalid createdDate or expiringOn format" });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: "Amount must be a non-negative number" });
    }

    const validStatus = ["Paid", "Unpaid", "Partial"];
    const finalStatus = status && validStatus.includes(status) ? status : "Unpaid";

    const subscription = await Subscription.create({
      subscriber: String(subscriber).trim(),
      plan: String(plan).trim(),
      billingCycle: String(billingCycle).trim(),
      paymentMethod: String(paymentMethod).trim(),
      billToAddress: String(billToAddress || "").trim(),
      amount: numericAmount,
      paidAmount: finalStatus === "Paid" ? numericAmount : 0,
      createdDate: parsedCreatedDate,
      expiringOn: parsedExpiringOn,
      status: finalStatus,
    });

    return res.status(201).json(subscription);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create subscription" });
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const serviceSubscriptions = await ServiceSubscription.find().populate("service_id", "serviceName");

    for (const serviceSub of serviceSubscriptions) {
      const serviceId = serviceSub?.service_id?._id || serviceSub?.service_id;
      if (!serviceId) continue;

      const existing = await Subscription.findOne({ sourceServiceId: serviceId }).select("_id");
      if (existing) continue;

      const serviceLabel =
        String(serviceSub?.service_name || serviceSub?.service_id?.serviceName || "").trim() ||
        "Service Subscription";

      await Subscription.create({
        sourceServiceId: serviceId,
        subscriber: serviceLabel,
        plan: serviceLabel,
        billingCycle: String(serviceSub?.billing_cycle || serviceSub?.renewal_type || "monthly").trim(),
        paymentMethod: "Cash",
        billToAddress: "",
        amount: Number(serviceSub?.amount || 0),
        paidAmount: 0,
        createdDate: serviceSub?.start_date || new Date(),
        expiringOn: serviceSub?.next_billing_date || new Date(),
        status: "Unpaid",
      });
    }

    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    return res.status(200).json(subscriptions);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch subscriptions" });
  }
};

const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.status(200).json(subscription);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch subscription" });
  }
};

const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Paid", "Unpaid", "Partial"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const current = await Subscription.findById(id);
    if (!current) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const update = { status };
    if (status === "Paid") {
      update.paidAmount = Number(current.amount || 0);
    } else if (status === "Unpaid") {
      update.paidAmount = 0;
    } else if (status === "Partial") {
      const currentPaid = Number(current.paidAmount || 0);
      const totalAmount = Number(current.amount || 0);
      if (currentPaid <= 0) {
        update.paidAmount = Math.min(totalAmount, Math.max(1, Math.floor(totalAmount / 2)));
      } else if (currentPaid >= totalAmount) {
        update.paidAmount = Math.max(totalAmount - 1, 0);
      } else {
        update.paidAmount = currentPaid;
      }
    }

    const updated = await Subscription.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update subscription status" });
  }
};

const addSubscriptionPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const totalAmount = Number(subscription.amount || 0);
    const currentPaid = Number(subscription.paidAmount || 0);

    if (currentPaid >= totalAmount) {
      return res.status(400).json({ message: "Subscription is already fully paid" });
    }

    const nextPaid = Math.min(totalAmount, currentPaid + amount);
    const nextStatus =
      nextPaid <= 0 ? "Unpaid" : nextPaid >= totalAmount ? "Paid" : "Partial";

    const updated = await Subscription.findByIdAndUpdate(
      id,
      { $set: { paidAmount: nextPaid, status: nextStatus } },
      { new: true, runValidators: false }
    );

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add payment" });
  }
};

const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Subscription.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete subscription" });
  }
};

const updateSubscriptionAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { billToAddress } = req.body;

    if (billToAddress === undefined || billToAddress === null || String(billToAddress).trim() === "") {
      return res.status(400).json({ message: "billToAddress is required" });
    }

    const updated = await Subscription.findByIdAndUpdate(
      id,
      { billToAddress: String(billToAddress).trim() },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update subscription address" });
  }
};

const uploadSubscriptionSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const shouldRemoveSignature =
      req.body?.removeSignature === true ||
      req.body?.removeSignature === "true" ||
      req.body?.removeSignature === 1 ||
      req.body?.removeSignature === "1";

    if (shouldRemoveSignature) {
      const updated = await Subscription.findByIdAndUpdate(
        id,
        {
          signatureData: "",
          signatureMimeType: "",
          signatureUpdatedAt: null,
        },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      return res.status(200).json(updated);
    }

    if (!req.file) {
      return res.status(400).json({ message: "Signature file is required" });
    }

    const updated = await Subscription.findByIdAndUpdate(
      id,
      {
        signatureData: req.file.buffer.toString("base64"),
        signatureMimeType: req.file.mimetype,
        signatureUpdatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save signature" });
  }
};

const removeSubscriptionSignature = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Subscription.findByIdAndUpdate(
      id,
      {
        signatureData: "",
        signatureMimeType: "",
        signatureUpdatedAt: null,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to remove signature" });
  }
};

const downloadSubscriptionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const safeName = String(subscription.subscriber || "subscription")
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "subscription";

    const amountNumber = Number(subscription.amount || 0);
    const paidNumber = Number(subscription.paidAmount || 0);
    const balanceNumber = Math.max(amountNumber - paidNumber, 0);
    const amountText = `Rs. ${amountNumber.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const paidText = `Rs. ${paidNumber.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const balanceText = `Rs. ${balanceNumber.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const formatDate = (value) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleDateString("en-IN");
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${safeName}-invoice.pdf\"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    const pageLeft = 40;
    const pageRight = 555;
    const contentWidth = pageRight - pageLeft;

    doc.font("Helvetica-Bold").fontSize(24).fillColor("#1976be");
    doc.text("INVOICE", pageLeft, 40, { width: contentWidth, align: "center" });

    const headerY = 90;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1976be").text("Premier Webtech", pageLeft, headerY);
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text("India", pageLeft, headerY + 20);
    doc.text("Email: support@premierwebtech.com", pageLeft, headerY + 38);

    const logoPath = path.join(process.cwd(), "..", "frontend", "src", "assessts", "premier-logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, pageRight - 125, headerY - 8, { fit: [110, 42], align: "right" });
      } catch (e) {
        // Keep PDF generation stable if logo is missing/corrupt.
      }
    }

    const dividerY = 150;
    doc.moveTo(pageLeft, dividerY).lineTo(pageRight, dividerY).lineWidth(1).strokeColor("#bdd6eb").stroke();

    const billY = 165;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1976be").text("Bill To", pageLeft, billY);
    doc.font("Helvetica").fontSize(10).fillColor("#1f2937").text(subscription.subscriber || "-", pageLeft, billY + 22);
    doc.text(subscription.billToAddress || "No address added", pageLeft, billY + 42, { width: 250 });

    const rightColX = 410;
    const valX = 505;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Invoice No :", rightColX, billY);
    doc.text(`INV${String(subscription._id || "").slice(-4).toUpperCase()}`, valX, billY, { width: 70, align: "right" });
    doc.font("Helvetica").text("Invoice Date :", rightColX, billY + 22);
    doc.text(formatDate(subscription.createdDate), valX, billY + 22, { width: 70, align: "right" });
    doc.text("Due Date :", rightColX, billY + 44);
    doc.text(formatDate(subscription.expiringOn), valX, billY + 44, { width: 70, align: "right" });

    const tableTop = 245;
    const tableHeaderHeight = 26;
    const rowHeight = 40;
    doc.rect(pageLeft, tableTop, contentWidth, tableHeaderHeight).fill("#1976be");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text("Sl", pageLeft + 10, tableTop + 8);
    doc.text("Description", pageLeft + 50, tableTop + 8);
    doc.text("Qty", pageLeft + 290, tableTop + 8);
    doc.text("Rate", pageLeft + 350, tableTop + 8, { width: 70, align: "right" });
    doc.text("Amount", pageLeft + 445, tableTop + 8, { width: 70, align: "right" });

    const rowTop = tableTop + tableHeaderHeight;
    doc.rect(pageLeft, rowTop, contentWidth, rowHeight).fillAndStroke("#ffffff", "#d1d5db");
    doc.font("Helvetica").fontSize(10).fillColor("#111827");
    doc.text("1", pageLeft + 10, rowTop + 14);
    doc.text(`${subscription.plan} Subscription (${subscription.billingCycle})`, pageLeft + 50, rowTop + 14, { width: 240 });
    doc.text("1", pageLeft + 290, rowTop + 14);
    doc.text(amountText, pageLeft + 350, rowTop + 14, { width: 70, align: "right" });
    doc.text(amountText, pageLeft + 445, rowTop + 14, { width: 70, align: "right" });

    const infoTop = rowTop + rowHeight + 20;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1976be").text("Payment Instructions", pageLeft, infoTop);
    doc.font("Helvetica").fontSize(10).fillColor("#1f2937").text(`Pay via ${subscription.paymentMethod}`, pageLeft, infoTop + 22);
    doc.text(`Amount Due: ${balanceText}`, pageLeft, infoTop + 42);

    const totalBoxX = 410;
    const totalBoxWidth = 145;
    doc.moveTo(totalBoxX, infoTop - 4).lineTo(totalBoxX + totalBoxWidth, infoTop - 4).lineWidth(1).strokeColor("#bdd6eb").stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
    doc.text("Sub Total", totalBoxX, infoTop + 6);
    doc.text(amountText, totalBoxX + 70, infoTop + 6, { width: 75, align: "right" });
    doc.text("Paid", totalBoxX, infoTop + 26);
    doc.text(paidText, totalBoxX + 70, infoTop + 26, { width: 75, align: "right" });
    doc.text("Tax", totalBoxX, infoTop + 46);
    doc.text("Rs. 0.00", totalBoxX + 70, infoTop + 46, { width: 75, align: "right" });
    doc.font("Helvetica-Bold");
    doc.text("Balance", totalBoxX, infoTop + 66);
    doc.text(balanceText, totalBoxX + 70, infoTop + 66, { width: 75, align: "right" });
    doc.moveTo(totalBoxX, infoTop + 86).lineTo(totalBoxX + totalBoxWidth, infoTop + 86).lineWidth(1).strokeColor("#bdd6eb").stroke();

    const signatureBoxTop = infoTop + 84;
    doc.rect(432, signatureBoxTop, 123, 68).stroke("#cbd5e1");

    if (subscription.signatureData && subscription.signatureMimeType) {
      const signatureBuffer = Buffer.from(subscription.signatureData, "base64");
      try {
        doc.image(signatureBuffer, 438, signatureBoxTop + 8, {
          fit: [111, 34],
          align: "center",
          valign: "center",
        });
      } catch (imageError) {
        // Keep PDF generation resilient even for old/invalid signature data.
      }
    }

    doc
      .fontSize(10)
      .fillColor("#374151")
      .text("Authorized Signatory", 432, signatureBoxTop + 46, {
        width: 123,
        align: "center",
      });

    doc.end();
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to generate invoice PDF" });
  }
};

module.exports = {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
  addSubscriptionPayment,
  deleteSubscription,
  updateSubscriptionAddress,
  uploadSignatureMiddleware,
  uploadSubscriptionSignature,
  removeSubscriptionSignature,
  downloadSubscriptionPdf,
};
