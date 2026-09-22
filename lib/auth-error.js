const messages = {
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password.",
  INVALID_PASSWORD: "Invalid email or password.",
  USER_NOT_FOUND: "Invalid email or password.",
  EMAIL_NOT_VERIFIED: "Verify your email before signing in.",
  USER_ALREADY_EXISTS: "An account already exists for this email. Sign in instead.",
  PASSWORD_TOO_SHORT: "Choose a password with at least 8 characters.",
  PASSWORD_TOO_LONG: "Choose a shorter password.",
};

export function getAuthErrorMessage(error) {
  const code = error?.code || error?.body?.code;
  if (code && messages[code]) return messages[code];

  const status = Number(error?.status || error?.statusCode);
  if (status === 401) return messages.INVALID_EMAIL_OR_PASSWORD;
  if (status === 409)
    return "An account already exists for this email. Sign in instead.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";

  return "Authentication is unavailable. Please try again.";
}
