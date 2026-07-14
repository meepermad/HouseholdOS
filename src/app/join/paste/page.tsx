"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasteInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-xl font-semibold">Enter invite token</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste the token from your invite URL (`/join/&lt;token&gt;`).
      </p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const cleaned = token.trim().replace(/^.*\/join\//, "");
          if (cleaned) router.push(`/join/${cleaned}`);
        }}
      >
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2"
          placeholder="Invite token or full URL"
        />
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
