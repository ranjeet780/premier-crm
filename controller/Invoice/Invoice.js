const Invoice = require("../../model/Invoice/Invoice");
const nodemailer = require("nodemailer");
const companyDetail = require('../../model/CompanyDetails/CompanyDetails')

function getProjectDisplayName(project) {
  if (!project || typeof project !== "object") return "Unnamed Project";
  return (
    project.projectName ||
    project.name ||
    project.project_title ||
    project.project_name ||
    project.title ||
    project.projectType ||
    project.project_type ||
    project.serviceName ||
    project.project ||
    (project.service && (project.service.serviceName || project.service.name)) || // <-- this line important!
    (typeof project.service === "string" && project.service) ||
    (Array.isArray(project.projectCategory) && project.projectCategory.length
      ? project.projectCategory.join(", ")
      : undefined) ||
    String(project) ||
    "Unnamed Project"
  );
}



// const createInvoice = async (req, res) => {
//   try {
//     const {
//       clientId,
//       clientEmail,
//       clientName,
//       projects,
//       dueDate,
//       sendNow,
//     } = req.body;

//     if (!clientId || !clientName || !clientEmail) {
//       return res.status(400).json({
//         error: "clientId, clientName and clientEmail required.",
//       });
//     }

//     if (!projects || !projects.length) {
//       return res.status(400).json({ error: "Projects required" });
//     }

//     // Normalize project names
//     const normalizedProjects = projects.map((p) => ({
//       ...p,
//       projectName: p.projectName || "Unnamed Project",
//       amount: Number(p.amount || 0),
//     }));

//     const totalAmount = normalizedProjects.reduce(
//       (sum, p) => sum + p.amount,
//       0
//     );

//     const invoice = new Invoice({
//       clientId,
//       clientEmail,
//       clientName,
//       projects: normalizedProjects,
//       invoiceNumber: "INV-" + Date.now(),
//       dueDate,
//       totalAmount,
//       sentFrom: process.env.EMAIL_USER,
//       status: sendNow ? "Pending" : "Draft",
//       isDraft: !sendNow,
//     });

//     await invoice.save();

//     // 🟡 Draft only
//     if (!sendNow) {
//       return res.status(201).json({
//         success: true,
//         message: "Invoice saved as draft.",
//         invoice,
//       });
//     }

//     // ✅ CORRECT SMTP CONFIG
//     const transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 587,
//       secure: false,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     // ✅ Verify SMTP
//     await transporter.verify();
//     console.log("✅ SMTP ready");

//     const fromEmail = process.env.EMAIL_USER;

//     await transporter.sendMail({
//       from: `"Premier WebTech" <${fromEmail}>`,
//       to: clientEmail,
//       subject: `Invoice #${invoice.invoiceNumber} (₹${totalAmount})`,
//       html: `
//         <div style="font-family: Arial; max-width: 600px;">
//           <h2>Invoice #${invoice.invoiceNumber}</h2>
//           <p>Dear ${clientName},</p>

//           <table border="1" width="100%" cellpadding="8" cellspacing="0">
//             ${normalizedProjects
//               .map(
//                 (p) => `
//                   <tr>
//                     <td>${p.projectName}</td>
//                     <td align="right">₹${p.amount.toLocaleString()}</td>
//                   </tr>`
//               )
//               .join("")}
//             <tr>
//               <td><strong>Total</strong></td>
//               <td align="right"><strong>₹${totalAmount.toLocaleString()}</strong></td>
//             </tr>
//           </table>

//           <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
//           <p>Regards,<br/>Premier WebTech</p>
//         </div>
//       `,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Invoice created and sent.",
//       invoice,
//     });
//   } catch (err) {
//     console.error("❌ createInvoice error:", err);
//     res.status(500).json({
//       error: "Invoice creation failed",
//       details: err.message,
//     });
//   }
// };


const createInvoice = async (req, res) => {
  try {
    const {
      clientId,
      clientEmail,
      clientName,
      clientGstNumber,
      clientAccountNo,
      taxName,
      taxAmount,
      projects,
      dueDate,
      paymentMethod,
      sendNow,
      currency,
    } = req.body;

    /* ---------- BASIC VALIDATION ---------- */
    if (!clientId || !clientName || !clientEmail) {
      return res.status(400).json({
        error: "clientId, clientName and clientEmail are required",
      });
    }

    if (!projects || !projects.length) {
      return res.status(400).json({ error: "At least one project is required" });
    }

    if (!dueDate) {
      return res.status(400).json({ error: "Due date is required" });
    }

    /* ---------- FETCH COMPANY DETAILS ---------- */
    const company = await companyDetail.findOne();

    if (!company) {
      return res.status(400).json({
        error: "Company details not configured",
      });
    }

    if (!company.email) {
      return res.status(400).json({
        error: "Company email missing in company details",
      });
    }

    /* ---------- NORMALIZE PROJECTS ---------- */
    const normalizedProjects = projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName || p.name || "Unnamed Project",
      name: p.projectName || p.name || "Unnamed Project",
      amount: Number(p.amount || 0),
    }));

    const subTotalAmount = normalizedProjects.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const finalTaxAmount = Number(taxAmount || 0);
    const totalAmount = subTotalAmount + finalTaxAmount;

    /* ---------- CREATE INVOICE ---------- */
    const invoice = new Invoice({
      clientId,
      clientEmail,
      clientName,
      clientGstNumber: clientGstNumber || "",
      clientAccountNo: clientAccountNo || "",
      taxName: taxName || "",
      taxAmount: finalTaxAmount,
      projects: normalizedProjects,
      invoiceNumber: "INV-" + Date.now(),
      dueDate,
      paymentMethod: paymentMethod || "UPI",
      currency: currency || "INR",
      totalAmount,
      subTotalAmount,
      companySnapshot: {
        name: company.name,
        email: company.email,
        phone: company.phone,
        website: company.website,
        taxId: company.taxId,
        address: company.address,
        bank: company.bank,
      },
      status: sendNow ? "Pending" : "Draft",
      isDraft: !sendNow,
      paidAmount: 0,
      remainingAmount: totalAmount,
    });

    await invoice.save();

    /* ---------- IF ONLY DRAFT ---------- */
    if (!sendNow) {
      return res.status(201).json({
        success: true,
        message: "Invoice saved as draft",
        invoice,
      });
    }

    /* ---------- EMAIL CONFIG ---------- */
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER, // SMTP login
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    /* ---------- SEND EMAIL ---------- */
    await transporter.sendMail({
      from: `"${company.name}" <${process.env.EMAIL_USER}>`,
      replyTo: company.email,
      to: clientEmail,
      subject: `Invoice #${invoice.invoiceNumber} (${currency || 'INR'} ${totalAmount})`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 660px; margin: auto; border: 1px solid #eee; padding: 32px; border-radius: 12px;">

        <h2 style="color:#1976d2;">Invoice from ${company.name}</h2>

        <p>Dear <b>${clientName}</b>,</p>
        <p>Please find your invoice details below:</p>

        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <thead>
            <tr>
              <th style="border:1px solid #ccc; padding:10px;">Project</th>
              <th style="border:1px solid #ccc; padding:10px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${normalizedProjects
          .map(
            (p) => `
                <tr>
                  <td style="border:1px solid #ccc; padding:10px;">${p.projectName}</td>
                  <td style="border:1px solid #ccc; padding:10px; text-align:right;">${currency || 'INR'} ${p.amount.toLocaleString()}</td>
                </tr>
              `
          )
          .join("")}
            <tr>
              <td style="border:1px solid #ccc; padding:10px; font-weight:bold;">Total</td>
              <td style="border:1px solid #ccc; padding:10px; text-align:right; font-weight:bold;">${currency || 'INR'} ${totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <p><b>Due Date:</b> ${new Date(dueDate).toLocaleDateString()}</p>

        <hr />

        <h4>Bank Details</h4>
        <ul>
          <li><b>Bank:</b> ${company.bank?.bankName || "-"}</li>
          <li><b>Account No:</b> ${company.bank?.accountNumber || "-"}</li>
          <li><b>IFSC:</b> ${company.bank?.ifsc || "-"}</li>
          ${company.taxId ? `<li><b>GST:</b> ${company.taxId}</li>` : ""}
        </ul>

        <hr />

        <p style="font-size:14px; color:#555;">
          <b>${company.name}</b><br/>
          ${company.address?.street || ""}, ${company.address?.city || ""}<br/>
          ${company.address?.state || ""}, ${company.address?.country || ""} - ${company.address?.zip || ""}<br/>
          <b>Email:</b> ${company.email} | <b>Phone:</b> ${company.phone}<br/>
          <b>Website:</b> <a href="${company.website}">${company.website}</a>
        </p>

      </div>
      `,
    });

    res.status(201).json({
      success: true,
      message: "Invoice created and sent successfully",
      invoice,
    });
  } catch (err) {
    console.error("❌ createInvoice error:", err);
    res.status(500).json({
      error: "Invoice creation failed",
      details: err.message,
    });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ date: -1 });
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET single invoice

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice)
      return res.status(404).json({ success: false, error: "Invoice not found" });
    res.json({ success: true, invoice }); // payment history included
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const markInvoicePaid = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { paidAmount } = req.body; // This is the payment being made now
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    // Add the new payment to the already paid
    const newPaidAmount = Number(invoice.paidAmount || 0) + Number(paidAmount);
    if (newPaidAmount > invoice.totalAmount) {
      return res.status(400).json({ error: "Total paid cannot exceed invoice total" });
    }

    invoice.paidAmount = newPaidAmount;
    invoice.remainingAmount = invoice.totalAmount - newPaidAmount;

    if (newPaidAmount === invoice.totalAmount) {
      invoice.status = "Paid";
      invoice.paidAt = new Date();
    } else if (newPaidAmount > 0) {
      invoice.status = "Partial";
      invoice.paidAt = new Date();
    } else {
      invoice.status = "Pending";
      invoice.paidAt = null;
    }

    await invoice.save();
    res.json({ success: true, message: "Invoice updated", invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// DELETE invoice
const deleteInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
const getInvoicesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const invoices = await Invoice.find({ clientId }).sort({ date: -1 });
    res.json({ success: true, invoices });
  } catch (error) {
    console.error("❌ Error fetching invoices by client:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
const addPayment = async (req, res) => {
  try {
    const { id } = req.params; // invoice id
    const { amount, method, note } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Log payment history entry
    invoice.payments = invoice.payments || [];
    invoice.payments.push({
      amount: Number(amount),
      method: method || invoice.paymentMethod || "UPI",
      note,
      date: new Date(),
    });

    // Update totals and status
    invoice.paidAmount += Number(amount);
    invoice.remainingAmount = Math.max(invoice.totalAmount - invoice.paidAmount, 0);

    if (invoice.paidAmount >= invoice.totalAmount) {
      invoice.status = "Paid";
      invoice.paidAt = new Date();
    } else if (invoice.paidAmount > 0) {
      invoice.status = "Partial";
    } else {
      invoice.status = "Pending";
    }

    await invoice.save();

    res.json({
      success: true,
      message: "Payment added successfully",
      invoice, // includes payment history
    });
  } catch (err) {
    console.error("Error adding payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }
    return res.json(invoice);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const payload = req.body || {};

    if (payload.clientName !== undefined) invoice.clientName = payload.clientName;
    if (payload.clientEmail !== undefined) invoice.clientEmail = payload.clientEmail;
    if (payload.dueDate !== undefined) invoice.dueDate = payload.dueDate;
    if (payload.date !== undefined) invoice.date = payload.date;
    if (payload.status !== undefined) invoice.status = payload.status;
    if (payload.currency !== undefined) invoice.currency = payload.currency;

    if (Array.isArray(payload.projects)) {
      invoice.projects = payload.projects.map((p) => ({
        projectId: p.projectId || null,
        projectName: p.projectName || p.name || "Unnamed Project",
        name: p.projectName || p.name || "Unnamed Project",
        amount: Number(p.amount || 0),
      }));
      invoice.totalAmount = invoice.projects.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    if (payload.paidAmount !== undefined) {
      invoice.paidAmount = Number(payload.paidAmount || 0);
    }

    invoice.remainingAmount = Math.max(
      Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0),
      0
    );

    if (invoice.paidAmount >= invoice.totalAmount && invoice.totalAmount > 0) {
      invoice.status = "Paid";
      invoice.paidAt = new Date();
    } else if (invoice.paidAmount > 0) {
      invoice.status = "Partial";
    } else if (invoice.status !== "Draft") {
      invoice.status = "Pending";
    }

    await invoice.save();
    return res.json({ success: true, message: "Invoice updated", invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const company = await companyDetail.findOne();
    if (!company || !company.email) {
      return res.status(400).json({ success: false, message: "Company email not configured" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const projectsHtml = (invoice.projects || [])
      .map(
        (p) =>
          `<tr><td style="padding:8px;border:1px solid #ddd;">${p.projectName || p.name || "Project"}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">${invoice.currency || 'INR'} ${Number(p.amount || 0).toLocaleString()}</td></tr>`
      )
      .join("");

    await transporter.sendMail({
      from: `"${company.name || "Company"}" <${process.env.EMAIL_USER}>`,
      replyTo: company.email,
      to: invoice.clientEmail,
      subject: `Invoice #${invoice.invoiceNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px">
          <h2>Invoice #${invoice.invoiceNumber}</h2>
          <p>Dear ${invoice.clientName || "Client"},</p>
          <table style="border-collapse:collapse;width:100%">
            ${projectsHtml}
            <tr>
              <td style="padding:8px;border:1px solid #ddd"><b>Total</b></td>
              <td style="padding:8px;border:1px solid #ddd;text-align:right"><b>${invoice.currency || 'INR'} ${Number(
        invoice.totalAmount || 0
      ).toLocaleString()}</b></td>
            </tr>
          </table>
        </div>
      `,
    });

    if (invoice.status === "Draft") invoice.status = "Pending";
    await invoice.save();

    return res.json({ success: true, message: "Invoice sent", invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { invoiceId } = req.body || {};
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: "invoiceId is required" });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const amount = Number(invoice.remainingAmount || invoice.totalAmount || 0);
    invoice.payments = invoice.payments || [];
    invoice.payments.push({
      amount,
      method: "Online",
      note: "Verified online payment",
      date: new Date(),
    });
    invoice.paidAmount = Number(invoice.paidAmount || 0) + amount;
    invoice.remainingAmount = Math.max(Number(invoice.totalAmount || 0) - invoice.paidAmount, 0);
    invoice.status = invoice.remainingAmount <= 0 ? "Paid" : "Partial";
    if (invoice.status === "Paid") invoice.paidAt = new Date();
    await invoice.save();

    return res.json({ success: true, message: "Payment verified", invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  addPayment,
  getAllInvoices,
  getInvoiceById,
  deleteInvoice,
  createInvoice,
  markInvoicePaid,
  getInvoicesByClient,
  getSingleInvoice,
  updateInvoice,
  sendInvoice,
  verifyPayment,
};
