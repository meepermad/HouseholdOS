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
      "This invitation has expired. Ask a household coordinator for a new link.",
    );
  }
  if (m.includes("revoked")) {
    return new AppError(
      "revoked_invitation",
      "This invitation was revoked. Ask a household coordinator for a new link.",
    );
  }
  if (m.includes("email mismatch")) {
    return new AppError(
      "invalid_invitation",
      "Sign in with the email address that received this invitation.",
    );
  }
  if (m.includes("already used") || m.includes("already accepted")) {
    return new AppError(
      "conflict",
      "This invitation has already been used.",
    );
  }
  if (m.includes("invalid")) {
    return new AppError(
      "invalid_invitation",
      "This invitation link is not valid.",
    );
  }
  return new AppError("invalid_invitation", "Unable to process this invitation.");
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
