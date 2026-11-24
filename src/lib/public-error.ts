import { ApiError } from "@/api/public";

export const visitAccessLost = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  [
    "TABLE_SESSION_REQUIRED",
    "INVALID_TABLE_QR",
    "ORDERING_NETWORK_REQUIRED",
  ].includes(error.code ?? "");

export function messageFor(error: unknown) {
  if (error instanceof ApiError && error.code === "INVALID_TABLE_QR") {
    return "This table code is invalid or no longer active. Please ask our staff for help.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
