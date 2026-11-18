import { ApiError } from "@/api/public";

export function messageFor(error: unknown) {
  if (error instanceof ApiError && error.code === "INVALID_TABLE_QR") {
    return "This table code is invalid or no longer active. Please ask our staff for help.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
