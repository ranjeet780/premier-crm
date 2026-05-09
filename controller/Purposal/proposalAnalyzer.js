function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function wordsCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function hasKeyword(text, keywords) {
  const normalized = text.toLowerCase();
  return keywords.some((word) => normalized.includes(word));
}

function roundScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeServices(services) {
  return toArray(services).map((service) => ({
    id: service?.id || "",
    name: toText(service?.name),
    price: Number(service?.price || 0),
  }));
}

function buildChecklist({
  title,
  services,
  descriptionWords,
  termsWords,
  category,
  totalPrice,
}) {
  return [
    { key: "title", label: "Title added", passed: !!title },
    { key: "services", label: "At least one service selected", passed: services.length > 0 },
    { key: "pricing", label: "Service prices are valid", passed: services.every((s) => s.price > 0) && totalPrice > 0 },
    { key: "description", label: "Description has enough detail", passed: descriptionWords >= 25 },
    { key: "terms", label: "Terms section has enough detail", passed: termsWords >= 20 },
    { key: "category", label: "At least one category selected", passed: category.length > 0 },
  ];
}

function buildRisks(combinedText) {
  const risks = [];

  if (
    !hasKeyword(combinedText, [
      "payment",
      "advance",
      "milestone",
      "invoice",
      "due",
      "installment",
    ])
  ) {
    risks.push({
      severity: "high",
      code: "payment_missing",
      message: "Payment schedule/terms are unclear.",
      suggestion: "Add payment split, due dates, and late-payment rule.",
    });
  }

  if (
    !hasKeyword(combinedText, [
      "timeline",
      "delivery",
      "deadline",
      "days",
      "weeks",
      "month",
      "sprint",
    ])
  ) {
    risks.push({
      severity: "high",
      code: "timeline_missing",
      message: "Timeline commitment is missing.",
      suggestion: "Add estimated start date, milestones, and final delivery date.",
    });
  }

  if (!hasKeyword(combinedText, ["revision", "rework", "changes", "iterations"])) {
    risks.push({
      severity: "medium",
      code: "revisions_missing",
      message: "Revision policy is not defined.",
      suggestion: "Mention number of free revisions and extra-change charges.",
    });
  }

  if (!hasKeyword(combinedText, ["cancel", "termination", "refund"])) {
    risks.push({
      severity: "medium",
      code: "cancellation_missing",
      message: "Cancellation/refund clause is missing.",
      suggestion: "Add cancellation window, refund scope, and termination terms.",
    });
  }

  return risks;
}

function analyzeProposalDraft(input = {}) {
  const title = toText(input.title);
  const description = toText(input.description);
  const terms = toText(input.terms);
  const category = toArray(input.category).map((c) => toText(c)).filter(Boolean);
  const services = normalizeServices(input.services);
  const totalPrice = services.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
  const descriptionWords = wordsCount(description);
  const termsWords = wordsCount(terms);

  let score = 100;
  if (!title) score -= 18;
  if (!services.length) score -= 22;
  if (services.some((service) => service.price <= 0)) score -= 12;
  if (descriptionWords < 25) score -= descriptionWords < 10 ? 20 : 10;
  if (termsWords < 20) score -= termsWords < 8 ? 16 : 8;
  if (!category.length) score -= 8;
  if (totalPrice <= 0) score -= 8;

  const combinedText = `${description} ${terms}`.toLowerCase();
  const risks = buildRisks(combinedText);
  score -= risks.filter((risk) => risk.severity === "high").length * 6;
  score -= risks.filter((risk) => risk.severity === "medium").length * 3;

  const checklist = buildChecklist({
    title,
    services,
    descriptionWords,
    termsWords,
    category,
    totalPrice,
  });

  const summary =
    score >= 80
      ? "Proposal is strong and ready to send with minor checks."
      : score >= 60
      ? "Proposal is workable, but improving highlighted risks is recommended."
      : "Proposal needs improvement before sending.";

  return {
    score: roundScore(score),
    summary,
    risks,
    checklist,
    metrics: {
      servicesCount: services.length,
      totalPrice,
      descriptionWords,
      termsWords,
      categoryCount: category.length,
    },
  };
}

module.exports = {
  analyzeProposalDraft,
};
