const Proposal = require("../../model/Purposal/Purposal");
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
  title,
  description,
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
      from: `"${companyName}" <${companyEmail}>`,
      replyTo: companyEmail,
      to: clientEmail,
      subject: `Proposal for ${clientName}`,
      html: `
        <div style=" font-family: Arial, sans-serif; max-width: 700px; padding: 24px; text-align: left">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="cid:companylogo" alt="${companyName}" style="max-width: 160px;" />
          </div>

          <h2 style="text-align: center;">Proposal for ${clientName}</h2>

          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Category:</strong> ${category.join(", ")}</p>

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
      category,
      terms,
      clientName,
      clientEmail,
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
          title,
          description,
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
    const { title, description, terms, services, category } = req.body;

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
        terms,
        status: "Sent",
        services: parsedServices,
        category: parsedCategory,
        attachments: allAttachments,
        aiInsights: insights,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    ).populate("clientId", "leadName emailId personal_email");

    if (!updatedProposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Determine client email and name for sending email
    const clientEmail =
      updatedProposal.clientId?.emailId || updatedProposal.clientId?.personal_email;
    const clientName =
      updatedProposal.clientId?.leadName || updatedProposal.clientId?.ename || "Client";

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
          title: updatedProposal.title,
          description: updatedProposal.description,
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

    return res.status(200).json({
      success: true,
      message: warning || "Proposal updated & sent successfully.",
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
