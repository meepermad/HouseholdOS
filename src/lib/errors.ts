export type AppErrorCode =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "expired_invitation"
  | "revoked_invitation"
  | "invalid_invitation"
  | "database_failure"
  | "missing_configuration"
  | "unexpected";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly publicMessage: string;

  constructor(code: AppErrorCode, publicMessage: string, status?: number) {
    super(publicMessage);
    this.name = "AppError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status ?? defaultStatus(code);
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "validation":
      return 400;
    case "authentication":
      return 401;
    case "authorization":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "expired_invitation":
    case "revoked_invitation":
    case "invalid_invitation":
      return 410;
    case "missing_configuration":
      return 500;
    case "database_failure":
    case "unexpected":
    default:
      return 500;
  }
}

const SAFE_AUTH_FAILURE =
  "Unable to sign in with those credentials. Check your email and password.";

/** Map unknown provider errors to safe user-facing messages. */
export function mapAuthError(error: { message?: string } | null | undefined): AppError {
  const message = (error?.message ?? "").toLowerCase();

  if (message.includes("email not confirmed")) {
    return new AppError(
      "authentication",
      "Please confirm your email before signing in.",
    );
  }
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return new AppError("authentication", SAFE_AUTH_FAILURE);
  }
  if (message.includes("user already registered")) {
    return new AppError(
      "conflict",
      "Unable to create an account with that email. Try signing in or resetting your password.",
    );
  }
  if (message.includes("password")) {
    return new AppError(
      "validation",
      "Password does not meet requirements. Use at least 8 characters.",
    );
  }
  return new AppError("authentication", SAFE_AUTH_FAILURE);
}

export function mapInvitationError(message: string): AppError {
  const m = message.toLowerCase();
  if (m.includes("expired")) {
    return new AppError(
      "expired_invitation",
      "This invitation expired.",
    );
  }
  if (m.includes("revoked")) {
    return new AppError(
      "revoked_invitation",
      "This invitation was revoked.",
    );
  }
  if (m.includes("email mismatch")) {
    return new AppError(
      "invalid_invitation",
      "This invitation belongs to another email address.",
    );
  }
  if (m.includes("already used") || m.includes("already accepted")) {
    return new AppError(
      "conflict",
      "This invitation has already been accepted.",
    );
  }
  if (m.includes("already a member") || m.includes("already member")) {
    return new AppError(
      "conflict",
      "You are already a member of this household.",
    );
  }
  if (m.includes("not authenticated")) {
    return new AppError("authentication", "You must sign in first.");
  }
  if (m.includes("invalid")) {
    return new AppError(
      "invalid_invitation",
      "This invitation link is not valid.",
    );
  }
  return new AppError("invalid_invitation", "Unable to process this invitation.");
}

/** Map create_household / bootstrap RPC failures to user-facing copy. */
export function mapHouseholdCreateError(message: string | undefined | null): AppError {
  const m = (message ?? "").toLowerCase();
  if (m.includes("not authenticated")) {
    return new AppError("authentication", "You must sign in first.");
  }
  if (m.includes("profile") || m.includes("ensure_profile")) {
    return new AppError(
      "database_failure",
      "Your profile could not be initialized.",
    );
  }
  if (m.includes("name too short") || m.includes("household name")) {
    return new AppError("validation", "Household name is required.");
  }
  if (m.includes("lease end") || m.includes("lease start")) {
    return new AppError("validation", "Lease end must follow lease start.");
  }
  if (m.includes("currency")) {
    return new AppError("validation", "Currency must be a 3-letter code like USD.");
  }
  if (m.includes("timezone")) {
    return new AppError("validation", "Timezone is required.");
  }
  if (m.includes("threshold")) {
    return new AppError("validation", "Purchase approval threshold is invalid.");
  }
  if (m.includes("reimbursement policy")) {
    return new AppError(
      "validation",
      "You must acknowledge the reimbursement policy.",
    );
  }
  if (m.includes("date") || m.includes("22007")) {
    return new AppError("validation", "Lease dates must be valid calendar dates.");
  }
  return new AppError(
    "database_failure",
    "This household could not be created.",
  );
}

export function toPublicErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.publicMessage;
  return "Something went wrong. Please try again.";
}

type LogFields = Record<string, string | number | boolean | null | undefined>;

/** Structured server log without secrets. */
export function logServerError(
  scope: string,
  error: unknown,
  fields: LogFields = {},
): void {
  const safe: Record<string, unknown> = {
    scope,
    ...fields,
  };
  if (error instanceof AppError) {
    safe.code = error.code;
    safe.message = error.publicMessage;
  } else if (error instanceof Error) {
    safe.name = error.name;
    // Avoid dumping potentially sensitive messages/stack to clients; server OK
    safe.message = error.message.slice(0, 200);
  } else {
    safe.message = "unknown_error";
  }
  console.error(JSON.stringify(safe));
}
