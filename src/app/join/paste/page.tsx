"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseInvitationPasteInput } from "@/lib/invitations/parse-paste";

export default function PasteInvitePage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-xl font-semibold">Enter invite token</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste a raw invitation token or a full `/join/&lt;token&gt;` link.
      </p>
      <form
        method="post"
        action="/join/paste"
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseInvitationPasteInput(value);
          if (!parsed.ok) {
            setError(parsed.error);
            return;
          }
          setError(null);
          router.push(`/join/${parsed.token}`);
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2"
          placeholder="Invite token or full join URL"
          autoComplete="off"
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
