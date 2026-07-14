import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        That page or household does not exist, or you do not have access.
      </p>
      <Link href="/app" className="mt-6 underline">
        Go to app
      </Link>
    </main>
  );
}
