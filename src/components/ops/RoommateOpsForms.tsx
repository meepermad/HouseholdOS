"use client";

import { useActionState } from "react";
import {
  createDirectoryContactAction,
  createMeetingNoteAction,
  createPackageAction,
  createSharedPurchaseAction,
} from "@/app/actions/roommate-ops";

export function RoommateOpsForms({
  householdId,
  members,
}: {
  householdId: string;
  members: { id: string; label: string }[];
}) {
  const [purchase, purchaseAction, purchasePending] = useActionState(
    createSharedPurchaseAction,
    null,
  );
  const [meeting, meetingAction, meetingPending] = useActionState(
    createMeetingNoteAction,
    null,
  );
  const [pkg, packageAction, packagePending] = useActionState(createPackageAction, null);
  const [contact, contactAction, contactPending] = useActionState(
    createDirectoryContactAction,
    null,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={purchaseAction} className="space-y-2 rounded-md border border-border p-3">
        <h3 className="font-semibold">Propose shared purchase</h3>
        <input type="hidden" name="householdId" value={householdId} />
        <input name="title" required placeholder="Title" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="estimatedAmountCents" type="number" min={0} placeholder="Estimate (cents)" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <textarea name="description" rows={2} placeholder="Notes" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        {purchase && !purchase.ok ? <p className="text-sm text-danger">{purchase.error}</p> : null}
        <button type="submit" disabled={purchasePending} className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Propose
        </button>
      </form>

      <form action={meetingAction} className="space-y-2 rounded-md border border-border p-3">
        <h3 className="font-semibold">Log meeting</h3>
        <input type="hidden" name="householdId" value={householdId} />
        <input name="title" required placeholder="Title" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="meetingAt" type="datetime-local" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <textarea name="agenda" rows={2} placeholder="Agenda" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <textarea name="outcomes" rows={2} placeholder="Outcomes" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        {meeting && !meeting.ok ? <p className="text-sm text-danger">{meeting.error}</p> : null}
        <button type="submit" disabled={meetingPending} className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Save meeting
        </button>
      </form>

      <form action={packageAction} className="space-y-2 rounded-md border border-border p-3">
        <h3 className="font-semibold">Log package</h3>
        <input type="hidden" name="householdId" value={householdId} />
        <select name="recipientMembershipId" className="w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">Recipient (optional)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <input name="carrier" placeholder="Carrier" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="locationNote" placeholder="Where it is" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        {pkg && !pkg.ok ? <p className="text-sm text-danger">{pkg.error}</p> : null}
        <button type="submit" disabled={packagePending} className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Log package
        </button>
      </form>

      <form action={contactAction} className="space-y-2 rounded-md border border-border p-3">
        <h3 className="font-semibold">Directory contact</h3>
        <input type="hidden" name="householdId" value={householdId} />
        <input name="name" required placeholder="Name" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="roleLabel" placeholder="Role" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
        {contact && !contact.ok ? <p className="text-sm text-danger">{contact.error}</p> : null}
        <button type="submit" disabled={contactPending} className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Add contact
        </button>
      </form>
    </div>
  );
}
