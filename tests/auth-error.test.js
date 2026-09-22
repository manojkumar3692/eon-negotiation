import test from "node:test";
import assert from "node:assert/strict";
import { getAuthErrorMessage } from "../lib/auth-error.js";

test("maps rejected sign-in responses to a useful message", () => {
  assert.equal(
    getAuthErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }),
    "Invalid email or password.",
  );
});

test("keeps service failures generic", () => {
  assert.equal(
    getAuthErrorMessage(new Error("connection details that should stay private")),
    "Authentication is unavailable. Please try again.",
  );
});
