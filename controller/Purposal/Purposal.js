const Proposal = require("../../model/Purposal/Purposal");
const ClientLead = require("../../model/ClientLead/ClientLead");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Company = require("../../model/CompanyDetails/CompanyDetails");
const { analyzeProposalDraft } = require("./proposalAnalyzer");

// Multer memory storage for uploaded files
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Email sending helper function


async function sendProposalEmail({
  companyEmail,
  clientEmail,
  clientName,
  clientPhone,
  title,
  description,
  companyDescription,
  category,
  services,
  terms,
  files = [],
}) {
  // ✅ SAME LOGIN AS INVOICE
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Logo (optional)
  const logoPath = path.join(
    __dirname,
    "..",
    "uploads",
    "logo",
    "premier-logo.png"
  );

  const attachments = [...files];

  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: "premier-logo.png",
      content: fs.readFileSync(logoPath),
      cid: "companylogo",
    });
  }

    // Fetch company details for branding
    const company = await Company.findOne();
    const companyName = company?.name || "Premier WEBTECH";

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.EMAIL_USER}>`,
      replyTo: companyEmail,
      to: clientEmail,
      subject: `Proposal for ${clientName}`,
      html: `
        <div style=" font-family: Arial, sans-serif; max-width: 700px; padding: 24px; text-align: left">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="cid:companylogo" alt="${companyName}" style="max-width: 160px;" />
          </div>

          <h2 style="text-align: center; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Proposal for ${clientName}</h2>

          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Client Information</h3>
            <p style="margin: 6px 0;"><strong>Name:</strong> ${clientName}</p>
            <p style="margin: 6px 0;"><strong>Email:</strong> ${clientEmail}</p>
            <p style="margin: 6px 0;"><strong>Phone:</strong> ${clientPhone || "N/A"}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Proposal Details</h3>
            <p style="margin: 6px 0;"><strong>Title:</strong> ${title}</p>
            <p style="margin: 6px 0; white-space: pre-wrap;"><strong>Project Description:</strong><br/>${description || "N/A"}</p>
            <p style="margin: 12px 0 6px 0; white-space: pre-wrap;"><strong>Company Description:</strong><br/>${companyDescription || "N/A"}</p>
            <p style="margin: 6px 0;"><strong>Category:</strong> ${category.join(", ")}</p>
          </div>

          <p><strong>Services:</strong></p>
          <ul>
            ${services
              .map(
                (s) =>
                  `<li>${s.name} - ₹${Number(s.price).toLocaleString()}</li>`
              )
              .join("")}
          </ul>

          <p><strong>Total Price:</strong> ₹${services
            .reduce((a, s) => a + Number(s.price || 0), 0)
            .toLocaleString()}</p>

          <p><strong>Terms:</strong> ${terms}</p>

          <br/>
          <p>Regards,<br/>
          <strong>${companyName}</strong></p>
        </div>
      `,
      attachments,
    });
}

const createAndSendProposal = async (req, res) => {
  try {
    const {
      clientId,
      title,
      services,
      description,
      companyDescription,
      category,
      terms,
      clientName,
      clientEmail,
      clientPhone,
    } = req.body;

    const parsedServices = JSON.parse(services || "[]");
    const parsedCategory = JSON.parse(category || "[]");
    const insights = analyzeProposalDraft({
      title,
      services: parsedServices,
      description,
      category: parsedCategory,
      terms,
    });

    // Save proposal
    const proposal = new Proposal({
      clientId,
      title,
      services: parsedServices,
      description,
      companyDescription,
      category: parsedCategory,
      terms,
      attachments: (req.files || []).map((f) => f.originalname),
      status: "Sent",
      aiInsights: insights,
    });

    await proposal.save();

    const company = await Company.findOne();
    let warning = "";

    if (!company || !company.email) {
      warning = "Proposal saved, but email was not sent (company email not configured).";
    } else if (!clientEmail) {
      warning = "Proposal saved, but email was not sent (client email missing).";
    } else {
      try {
        // Send proposal email
        await sendProposalEmail({
          companyEmail: company.email,
          clientEmail,
          clientName,
          clientPhone,
          title,
          description,
          companyDescription,
          category: parsedCategory,
          services: parsedServices,
          terms,
          files: (req.files || []).map((file) => ({
            filename: file.originalname,
            content: file.buffer,
          })),
        });
      } catch (mailErr) {
        console.error("Proposal email send failed after save:", mailErr);
        warning = "Proposal saved, but email sending failed.";
      }
    }

    res.status(201).json({
      success: true,
      message: warning || "Proposal sent successfully",
      warning,
      proposal,
      insights,
    });
  } catch (err) {
    console.error("Proposal send error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


const updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, companyDescription, terms, services, category, status, sendEmail } = req.body;

    // Parse services and category JSON strings to arrays
    const parsedServices = services ? JSON.parse(services) : [];
    const parsedCategory = category ? JSON.parse(category) : [];
    const insights = analyzeProposalDraft({
      title,
      services: parsedServices,
      description,
      category: parsedCategory,
      terms,
    });

    // Parse existing attachments from body (support both keys)
    let existingAttachments = [];
    const rawExisting =
      req.body.existingAttachments ?? req.body["existingAttachments[]"];
    if (rawExisting) {
      existingAttachments = Array.isArray(rawExisting) ? rawExisting : [rawExisting];
    }

    // Extract newly uploaded files' original names
    const uploadedFiles = (req.files || []).map((file) => file.originalname);

    // Combine existing and newly uploaded attachments
    const allAttachments = [...existingAttachments, ...uploadedFiles];

    // Update proposal document in database
    const updatedProposal = await Proposal.findByIdAndUpdate(
      id,
      {
        title,
        description,
        companyDescription,
        terms,
        status: status || (sendEmail === "false" ? "Draft" : "Sent"),
        services: parsedServices,
        category: parsedCategory,
        attachments: allAttachments,
        aiInsights: insights,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    ).populate("clientId", "leadName emailId personal_email phoneNo");

    if (!updatedProposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Update associated ClientLeadData
    if (updatedProposal.clientId?._id) {
      const ClientLead = require("../../model/ClientLead/ClientLead");
      const clientUpdate = {};
      if (req.body.clientName) clientUpdate.leadName = req.body.clientName;
      if (req.body.clientEmail) clientUpdate.emailId = req.body.clientEmail;
      if (req.body.clientPhone) clientUpdate.phoneNo = req.body.clientPhone;

      if (Object.keys(clientUpdate).length > 0) {
        await ClientLead.findByIdAndUpdate(updatedProposal.clientId._id, clientUpdate);
        
        // Also update the populated fields on the updatedProposal instance so we use the new values
        if (clientUpdate.leadName) updatedProposal.clientId.leadName = clientUpdate.leadName;
        if (clientUpdate.emailId) updatedProposal.clientId.emailId = clientUpdate.emailId;
        if (clientUpdate.phoneNo) updatedProposal.clientId.phoneNo = clientUpdate.phoneNo;
      }
    }

    // Determine client email and name for sending email
    const clientEmail =
      req.body.clientEmail || updatedProposal.clientId?.emailId || updatedProposal.clientId?.personal_email;
    const clientName =
      req.body.clientName || updatedProposal.clientId?.leadName || updatedProposal.clientId?.ename || "Client";
    const clientPhone =
      req.body.clientPhone || updatedProposal.clientId?.phoneNo || "";

    // Prepare email attachments array
    const emailAttachments = [];

    // Add existing attachments by reading file buffers from disk (adjust path accordingly)
    for (const fileName of existingAttachments) {
      if (fileName) {
        try {
          const filePath = path.join(__dirname, "..", "uploads", "attachments", fileName);
          emailAttachments.push({
            filename: fileName,
            content: fs.readFileSync(filePath),
          });
        } catch (e) {
          console.warn("Failed to read file for email attachment:", fileName);
        }
      }
    }

    // Add new file buffers from uploaded files
    emailAttachments.push(
      ...(req.files || []).map((file) => ({
        filename: file.originalname,
        content: file.buffer,
      }))
    );

    // Fetch company email
    const company = await Company.findOne();
    let warning = "";

    const shouldSendEmail = sendEmail !== "false";

    if (shouldSendEmail) {
      if (!company || !company.email) {
        warning = "Proposal updated, but email was not sent (company email not configured).";
      } else if (!clientEmail) {
        warning = "Proposal updated, but email was not sent (client email missing).";
      } else {
        try {
          // Send updated proposal email with attachments
          await sendProposalEmail({
            companyEmail: company.email,
            clientEmail,
            clientName,
            clientPhone,
            title: updatedProposal.title,
            description: updatedProposal.description,
            companyDescription: updatedProposal.companyDescription,
            category: updatedProposal.category || [],
            services: updatedProposal.services || [],
            terms: updatedProposal.terms,
            files: emailAttachments,
          });
        } catch (mailErr) {
          console.error("Proposal email send failed after update:", mailErr);
          warning = "Proposal updated, but email sending failed.";
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: warning || (shouldSendEmail ? "Proposal updated & sent successfully." : "Proposal saved successfully."),
      warning,
      proposal: updatedProposal,
      insights,
    });
  } catch (err) {
    console.error("Error updating proposal:", err);
    res.status(500).json({ message: "Server error while updating proposal" });
  }
};


const getAllProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find()
      .populate("clientId", "leadName")
      .sort({ createdAt: -1 });
    res.status(200).json(proposals);
  } catch (err) {
    console.error("Error fetching proposals:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProposal = await Proposal.findByIdAndDelete(id);
    if (!deletedProposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    res.status(200).json({ message: "Proposal deleted successfully" });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    res.status(500).json({ message: "Server error while deleting proposal" });
  }
};

const getProposalById = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id)
      .populate("clientId", "leadName emailId phoneNo")
      .lean();
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    res.status(200).json(proposal);
  } catch (error) {
    console.error("Error fetching proposal by ID:", error);
    res.status(500).json({ message: "Server error while fetching proposal" });
  }
};

const approveProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["Accepted", "Rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updatedProposal = await Proposal.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedProposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    res.status(200).json(updatedProposal);
  } catch (err) {
    console.error("Error updating proposal status:", err);
    res.status(500).json({ message: "Server error while updating status" });
  }
};

const analyzeProposal = async (req, res) => {
  try {
    const {
      title = "",
      services = [],
      description = "",
      category = [],
      terms = "",
    } = req.body || {};

    const insights = analyzeProposalDraft({
      title,
      services,
      description,
      category,
      terms,
    });

    return res.status(200).json({
      success: true,
      insights,
    });
  } catch (err) {
    console.error("Error analyzing proposal:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to analyze proposal",
    });
  }
};

module.exports = {
  createAndSendProposal,
  upload,
  getAllProposals,
  updateProposal,
  deleteProposal,
  getProposalById,
  approveProposal,
  analyzeProposal,
};
