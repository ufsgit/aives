const DEV_FALLBACK_JWT_SECRET = "brooks-local-dev-jwt-secret-change-me";

let cachedSecret;
let warnedMissingSecret = false;

function getJwtSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = String(
    process.env.jwtSecret || process.env.JWT_SECRET || ""
  ).trim();

  if (secret) {
    cachedSecret = secret;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT secret is missing. Set jwtSecret (or JWT_SECRET) in your environment."
    );
  }

  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[auth] jwtSecret is not configured. Falling back to a development-only secret."
    );
  }

  cachedSecret = DEV_FALLBACK_JWT_SECRET;
  return cachedSecret;
}

module.exports = { getJwtSecret };
