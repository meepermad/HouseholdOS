"use client";

import { useState } from "react";

/**
 * Password field with show/hide — works without JS (type=password stays hidden;
 * toggle is progressive enhancement).
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  minLength = 8,
  required = true,
  id,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? name;

  return (
    <label className="block text-sm text-text-primary" htmlFor={fieldId}>
      {label}
      <div className="relative mt-1">
        <input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full rounded-md border border-border bg-input-bg px-3 py-2 pr-16 text-text-primary"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-text-secondary underline-offset-2 hover:underline"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

export function PasswordRequirements() {
  return (
    <ul className="list-inside list-disc text-xs text-text-muted">
      <li>At least 8 characters</li>
      <li>Use a unique password you do not reuse elsewhere</li>
    </ul>
  );
}
