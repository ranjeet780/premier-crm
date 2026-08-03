const Invoice = require("../../model/Invoice/Invoice");
const ClientLead = require("../../model/ClientLead/ClientLead");
const nodemailer = require("nodemailer");
const companyDetail = require('../../model/CompanyDetails/CompanyDetails');
const PDFDocument = require("pdfkit");

function generateInvoicePdfBuffer(invoice, company) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const pageLeft = 40;
      const pageRight = 555;
      const contentWidth = pageRight - pageLeft;

      doc.font("Helvetica-Bold").fontSize(24).fillColor("#1976be");
      doc.text("INVOICE", pageLeft, 40, { width: contentWidth, align: "center" });

      const headerY = 85;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#1976be").text(company?.name || "Premier Webtech", pageLeft, headerY);
      doc.font("Helvetica").fontSize(9).fillColor("#374151");
      let compInfoY = headerY + 18;
      if (company?.address) {
        const addr = [company.address.street, company.address.city, company.address.state, company.address.country].filter(Boolean).join(", ");
        if (addr) {
          doc.text(addr, pageLeft, compInfoY);
          compInfoY += 14;
        }
      }
      if (company?.email) {
        doc.text(`Email: ${company.email}`, pageLeft, compInfoY);
        compInfoY += 14;
      }
      if (company?.phone) {
        doc.text(`Phone: ${company.phone}`, pageLeft, compInfoY);
      }

      const dividerY = 145;
      doc.moveTo(pageLeft, dividerY).lineTo(pageRight, dividerY).lineWidth(1).strokeColor("#bdd6eb").stroke();

      const billY = 160;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1976be").text("Bill To", pageLeft, billY);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1f2937").text(invoice.clientName || "-", pageLeft, billY + 18);
      if (invoice.clientEmail) {
        doc.font("Helvetica").fontSize(9).text(`Email: ${invoice.clientEmail}`, pageLeft, billY + 34);
      }

      const rightColX = 390;
      const valX = 480;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text("Invoice No :", rightColX, billY);
      doc.text(String(invoice.invoiceNumber || "-"), valX, billY, { width: 75, align: "right" });

      const formatDate = (d) => {
        if (!d) return "-";
        const date = new Date(d);
        return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
      };

      doc.font("Helvetica").text("Invoice Date :", rightColX, billY + 16);
      doc.text(formatDate(invoice.date || invoice.createdAt), valX, billY + 16, { width: 75, align: "right" });
      doc.text("Due Date :", rightColX, billY + 32);
      doc.text(formatDate(invoice.dueDate), valX, billY + 32, { width: 75, align: "right" });

      const currency = invoice.currency || "INR";
      const currSym = { INR: "Rs ", USD: "$ ", EUR: "EUR ", GBP: "GBP ", CAD: "CA$ " }[currency] || "Rs ";

      const tableTop = 225;
      const tableHeaderHeight = 24;
      doc.rect(pageLeft, tableTop, contentWidth, tableHeaderHeight).fill("#1976be");
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
      doc.text("Sl", pageLeft + 10, tableTop + 7);
      doc.text("Description", pageLeft + 50, tableTop + 7);
      doc.text("Qty", pageLeft + 290, tableTop + 7);
      doc.text("Rate", pageLeft + 350, tableTop + 7, { width: 70, align: "right" });
      doc.text("Amount", pageLeft + 445, tableTop + 7, { width: 70, align: "right" });

      let currentY = tableTop + tableHeaderHeight;
      const projects = Array.isArray(invoice.projects) && invoice.projects.length
        ? invoice.projects
        : [{ name: "Service", amount: invoice.totalAmount }];

      projects.forEach((p, idx) => {
        const amt = Number(p.amount || 0);
        doc.rect(pageLeft, currentY, contentWidth, 30).fillAndStroke("#ffffff", "#e5e7eb");
        doc.font("Helvetica").fontSize(9).fillColor("#111827");
        doc.text(String(idx + 1), pageLeft + 10, currentY + 9);
        doc.text(p.projectName || p.name || "Service", pageLeft + 50, currentY + 9, { width: 230 });
        doc.text("1", pageLeft + 290, currentY + 9);
        doc.text(`${currSym}${amt.toLocaleString()}`, pageLeft + 350, currentY + 9, { width: 70, align: "right" });
        doc.text(`${currSym}${amt.toLocaleString()}`, pageLeft + 445, currentY + 9, { width: 70, align: "right" });
        currentY += 30;
      });

      const infoTop = currentY + 20;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1976be").text("Payment & Bank Details", pageLeft, infoTop);
      doc.font("Helvetica").fontSize(9).fillColor("#1f2937");
      let py = infoTop + 16;
      doc.text(`Method: ${invoice.paymentMethod || "Bank / UPI"}`, pageLeft, py);
      py += 14;
      doc.text(`Status: ${invoice.status || "Pending"}`, pageLeft, py);
      py += 14;
      if (company?.bank?.bankName) {
        doc.text(`Bank: ${company.bank.bankName}`, pageLeft, py);
        py += 14;
        doc.text(`A/C: ${company.bank.accountNumber || "-"} | IFSC: ${company.bank.ifsc || "-"}`, pageLeft, py);
        py += 14;
      }
      if (company?.taxId) {
        doc.text(`GSTIN: ${company.taxId}`, pageLeft, py);
      }

      const totalBoxX = 390;
      const subTotal = Number(invoice.subTotalAmount !== undefined ? invoice.subTotalAmount : invoice.totalAmount || 0);
      const taxAmt = Number(invoice.taxAmount || 0);
      const totalAmt = Number(invoice.totalAmount || 0);
      const paidAmt = Number(invoice.paidAmount || 0);
      const balAmt = Math.max(totalAmt - paidAmt, 0);

      doc.font("Helvetica").fontSize(9).fillColor("#1f2937");
      doc.text("Sub Total:", totalBoxX, infoTop);
      doc.text(`${currSym}${subTotal.toLocaleString()}`, totalBoxX + 70, infoTop, { width: 95, align: "right" });

      let nextRowY = infoTop + 16;
      if (taxAmt > 0) {
        doc.text(`${invoice.taxName || "Tax"}:`, totalBoxX, nextRowY);
        doc.text(`${currSym}${taxAmt.toLocaleString()}`, totalBoxX + 70, nextRowY, { width: 95, align: "right" });
        nextRowY += 16;
      }

      doc.text("Paid:", totalBoxX, nextRowY);
      doc.text(`${currSym}${paidAmt.toLocaleString()}`, totalBoxX + 70, nextRowY, { width: 95, align: "right" });
      nextRowY += 18;

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
      doc.text("Balance Due:", totalBoxX, nextRowY);
      doc.text(`${currSym}${balAmt.toLocaleString()}`, totalBoxX + 70, nextRowY, { width: 95, align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function generateInvoiceEmailHtml(invoice, company) {
  const currency = invoice.currency || "INR";
  const currSym = { INR: "₹", USD: "$", EUR: "€", GBP: "£", CAD: "CA$" }[currency] || "₹";

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const projects = Array.isArray(invoice.projects) && invoice.projects.length
    ? invoice.projects
    : [{ name: "Service", amount: invoice.totalAmount }];

  const subTotal = Number(invoice.subTotalAmount !== undefined ? invoice.subTotalAmount : invoice.totalAmount || 0);
  const taxAmt = Number(invoice.taxAmount || 0);
  const totalAmt = Number(invoice.totalAmount || 0);
  const paidAmt = Number(invoice.paidAmount || 0);
  const balAmt = Math.max(totalAmt - paidAmt, 0);

  const projectsRows = projects
    .map(
      (p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; font-size: 14px; color: #1e293b; text-align: center;">${idx + 1}</td>
        <td style="padding: 12px; font-size: 14px; color: #1e293b; font-weight: 600;">${getProjectDisplayName(p)}</td>
        <td style="padding: 12px; font-size: 14px; color: #1e293b; text-align: center;">1</td>
        <td style="padding: 12px; font-size: 14px; color: #1e293b; text-align: right;">${currSym} ${Number(p.amount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 12px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">${currSym} ${Number(p.amount || 0).toLocaleString('en-IN')}</td>
      </tr>`
    )
    .join("");

  const compAddr = company?.address
    ? [company.address.street, company.address.city, company.address.state, company.address.country, company.address.zip].filter(Boolean).join(", ")
    : "";

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fb; padding: 30px 15px; margin: 0;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(120deg, #0b1f3a 0%, #123b67 52%, #1e5f97 100%); padding: 30px 32px; color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255, 255, 255, 0.75);">Official Invoice</p>
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">${company?.name || "Premier Webtech"}</h1>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span style="display: inline-block; padding: 6px 16px; border-radius: 20px; background: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 14px; font-weight: 700; border: 1px solid rgba(255, 255, 255, 0.25);">
                  # ${invoice.invoiceNumber || 'INV'}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Body Content -->
        <div style="padding: 32px;">
          <p style="font-size: 15px; color: #334155; margin-top: 0;">Dear <b>${invoice.clientName || 'Valued Client'}</b>,</p>
          <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
            Thank you for your business. Please find below the detailed summary for <b>Invoice #${invoice.invoiceNumber}</b>. A complete PDF version has also been attached to this email for your records.
          </p>

          <!-- Client & Invoice Info Grid -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 18px 20px; width: 50%; vertical-align: top; border-right: 1px solid #e2e8f0;">
                <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">Billed To</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">${invoice.clientName || '-'}</p>
                ${invoice.clientEmail ? `<p style="margin: 4px 0 0; font-size: 13px; color: #475569;">${invoice.clientEmail}</p>` : ''}
                ${invoice.clientGstNumber ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;"><b>GSTIN:</b> ${invoice.clientGstNumber}</p>` : ''}
              </td>
              <td style="padding: 18px 20px; width: 50%; vertical-align: top;">
                <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">Invoice Details</p>
                <p style="margin: 0; font-size: 13px; color: #334155;"><b>Date:</b> ${formatDate(invoice.date || invoice.createdAt)}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #334155;"><b>Due Date:</b> ${formatDate(invoice.dueDate)}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #334155;"><b>Status:</b> <span style="font-weight: 700; color: ${invoice.status === 'Paid' ? '#059669' : '#d97706'};">${invoice.status || 'Pending'}</span></p>
              </td>
            </tr>
          </table>

          <!-- Line Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #1e3a5f; color: #ffffff;">
                <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; border-radius: 8px 0 0 0;">#</th>
                <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Service / Project</th>
                <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Qty</th>
                <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Rate</th>
                <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-radius: 0 8px 0 0;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${projectsRows}
            </tbody>
          </table>

          <!-- Totals Summary -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
            <tr>
              <td style="width: 55%; vertical-align: top; padding-right: 20px;">
                <!-- Payment Instructions -->
                <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; border: 1px solid #cbd5e1;">
                  <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1e293b;">Bank Payment Details</p>
                  <p style="margin: 0 0 4px; font-size: 13px; color: #334155;"><b>Bank Name:</b> ${company?.bank?.bankName || '-'}</p>
                  <p style="margin: 0 0 4px; font-size: 13px; color: #334155;"><b>Account Holder:</b> ${company?.bank?.accountName || company?.name || '-'}</p>
                  <p style="margin: 0 0 4px; font-size: 13px; color: #334155;"><b>Account No:</b> ${company?.bank?.accountNumber || '-'}</p>
                  <p style="margin: 0 0 4px; font-size: 13px; color: #334155;"><b>IFSC Code:</b> ${company?.bank?.ifsc || '-'}</p>
                  ${company?.taxId ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;"><b>Company GST:</b> ${company.taxId}</p>` : ''}
                </div>
              </td>
              <td style="width: 45%; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Subtotal:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${currSym} ${subTotal.toLocaleString('en-IN')}</td>
                  </tr>
                  ${taxAmt > 0 ? `
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #64748b;">${invoice.taxName || 'Tax'}:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${currSym} ${taxAmt.toLocaleString('en-IN')}</td>
                  </tr>` : ''}
                  <tr style="border-top: 1px solid #e2e8f0; border-bottom: 2px solid #0f172a;">
                    <td style="padding: 10px 0; font-size: 15px; font-weight: 800; color: #0f172a;">Total Amount:</td>
                    <td style="padding: 10px 0; font-size: 16px; font-weight: 800; color: #1e3a5f; text-align: right;">${currSym} ${totalAmt.toLocaleString('en-IN')}</td>
                  </tr>
                  ${paidAmt > 0 ? `
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #059669; font-weight: 600;">Paid Amount:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #059669; text-align: right; font-weight: 700;">${currSym} ${paidAmt.toLocaleString('en-IN')}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 8px 0 0; font-size: 14px; font-weight: 700; color: #b91c1c;">Balance Due:</td>
                    <td style="padding: 8px 0 0; font-size: 15px; font-weight: 800; color: #b91c1c; text-align: right;">${currSym} ${balAmt.toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </div>

        <!-- Footer Banner -->
        <div style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;">
          <p style="margin: 0; font-weight: 700; color: #1e293b;">${company?.name || "Premier Webtech"}</p>
          ${compAddr ? `<p style="margin: 2px 0;">${compAddr}</p>` : ''}
          <p style="margin: 2px 0;">
            ${company?.email ? `Email: ${company.email} | ` : ''}
            ${company?.phone ? `Phone: ${company.phone}` : ''}
          </p>
          ${company?.website ? `<p style="margin: 2px 0;"><a href="${company.website}" style="color: #2563eb; text-decoration: none;">${company.website}</a></p>` : ''}
        </div>

      </div>
    </div>
  `;
}

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

    const pdfBuffer = await generateInvoicePdfBuffer(invoice, company);
    const pdfAttachments = [
      {
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];

    /* ---------- SEND EMAIL ---------- */
    const emailHtml = generateInvoiceEmailHtml(invoice, company);

    transporter.sendMail({
      from: `"${company.name}" <${process.env.EMAIL_USER}>`,
      replyTo: company.email,
      to: clientEmail,
      subject: `Invoice #${invoice.invoiceNumber} (${currency || 'INR'} ${totalAmount.toLocaleString('en-IN')})`,
      html: emailHtml,
      attachments: pdfAttachments,
    }).catch(err => {
      console.error("❌ invoice email send failed asynchronously:", err.message);
    });

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
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
    const { amount, method, note, bankName } = req.body;

    if (!bankName) {
      return res.status(400).json({ success: false, message: "Bank Name is required for payment" });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Log payment history entry
    invoice.payments = invoice.payments || [];
    invoice.payments.push({
      amount: Number(amount),
      method: method || invoice.paymentMethod || "UPI",
      bankName: req.body.bankName || "",
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

    let targetEmail = invoice.clientEmail;
    if (!targetEmail && invoice.clientId) {
      const client = await ClientLead.findById(invoice.clientId);
      if (client && client.email) {
        targetEmail = client.email;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ success: false, message: "Client email ID is missing for this invoice." });
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

    const pdfBuffer = await generateInvoicePdfBuffer(invoice, company);
    const pdfAttachments = [
      {
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];

    const emailHtml = generateInvoiceEmailHtml(invoice, company);

    await transporter.sendMail({
      from: `"${company.name || "Company"}" <${process.env.EMAIL_USER}>`,
      replyTo: company.email,
      to: targetEmail,
      subject: `Invoice #${invoice.invoiceNumber} (${invoice.currency || 'INR'} ${Number(invoice.totalAmount || 0).toLocaleString('en-IN')})`,
      html: emailHtml,
      attachments: pdfAttachments,
    });

    if (invoice.status === "Draft") invoice.status = "Pending";
    await invoice.save();

    return res.json({ success: true, message: "Invoice email sent successfully with PDF attached!", invoice });
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
