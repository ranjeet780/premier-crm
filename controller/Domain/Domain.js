const Domain = require("../../model/Domain/Domain");

const parseDate = (value) => {
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

  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = raw.match(slashPattern);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const slashDate = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(slashDate.getTime()) ? null : slashDate;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const createDomain = async (req, res) => {
  try {
    const { 
      name, 
      url, 
      plan, 
      clientName, 
      purchasedOn, 
      expireDate, 
      platform, 
      actualAmount, 
      paidAmount 
    } = req.body;

    if (!name || !url || !plan || !clientName || !purchasedOn || !expireDate || !platform || !actualAmount || !paidAmount) {
      return res.status(400).json({ 
        message: "name, url, plan, clientName, purchasedOn, expireDate, platform, actualAmount and paidAmount are required" 
      });
    }

    const parsedPurchasedOn = parseDate(purchasedOn);
    const parsedExpireDate = parseDate(expireDate);

    if (!parsedPurchasedOn) {
      return res.status(400).json({ message: "Invalid purchasedOn format" });
    }
    if (!parsedExpireDate) {
      return res.status(400).json({ message: "Invalid expireDate format" });
    }

    const domain = await Domain.create({
      name: String(name).trim(),
      url: String(url).trim(),
      plan: String(plan).trim(),
      clientName: String(clientName).trim(),
      platform: String(platform).trim(),
      purchasedOn: parsedPurchasedOn,
      expireDate: parsedExpireDate,
      actualAmount: Number(actualAmount),
      paidAmount: Number(paidAmount),
      status: "Unpaid",
    });

    return res.status(201).json(domain);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create domain" });
  }
};

const getDomains = async (req, res) => {
  try {
    const domains = await Domain.find().sort({ createdAt: -1 });
    return res.status(200).json(domains);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch domains" });
  }
};

const updateDomainStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Paid", "Unpaid"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await Domain.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Domain not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update domain status" });
  }
};

const deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Domain.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Domain not found" });
    }

    return res.status(200).json({ message: "Domain deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete domain" });
  }
};

module.exports = {
  createDomain,
  getDomains,
  updateDomainStatus,
  deleteDomain,
};
