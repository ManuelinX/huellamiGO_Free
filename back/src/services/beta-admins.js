function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

export function getBetaShieldAdminEmails() {
  return (process.env.BETA_SHIELD_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isBetaShieldAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return Boolean(normalizedEmail && getBetaShieldAdminEmails().includes(normalizedEmail));
}
