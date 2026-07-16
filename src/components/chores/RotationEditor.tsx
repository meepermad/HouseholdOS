"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createRotationAction, updateRotationAction } from "@/app/actions/chores";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ChoreRotationView } from "@/lib/chores/queries";
import type { RotationStrategy } from "@/lib/chores/types";
import { MultiAssigneeSelector } from "./MultiAssigneeSelector";
import { RotationPreview } from "./RotationPreview";

export function RotationEditor({ householdId, members, rotation }: { householdId: string; members: Array<{ id: string; label: string }>; rotation?: ChoreRotationView }) {
  const [selected, setSelected] = useState(rotation?.members.map((m) => m.id) ?? []);
  const [strategy, setStrategy] = useState<RotationStrategy>(rotation?.strategy ?? "round_robin");
  const selectedMembers = selected.map((id) => members.find((m) => m.id === id)).filter((m): m is { id: string; label: string } => Boolean(m));
  return (
    <ActionForm action={rotation ? updateRotationAction : createRotationAction} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {rotation ? <input type="hidden" name="rotationId" value={rotation.id} /> : null}
      <input type="hidden" name="membershipIdsJson" value={JSON.stringify(selected)} />
      <Field label="Rotation name"><Input name="name" required defaultValue={rotation?.name} /></Field>
      <Field label="Strategy">
        <Select name="strategy" value={strategy} onChange={(e) => setStrategy(e.target.value as RotationStrategy)}>
          <option value="round_robin">Round robin</option><option value="balanced">Balanced</option>
          <option value="fixed">Fixed</option><option value="manual_sequence">Manual sequence</option>
        </Select>
      </Field>
      <Field label="Starts with">
        <Select name="startMembershipId" defaultValue={rotation?.startMembershipId ?? ""}>
          <option value="">First member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </Select>
      </Field>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Members in order</legend><MultiAssigneeSelector members={members} value={selected} onChange={setSelected} /></fieldset>
      <div className="rounded-md border border-border bg-surface-secondary p-3"><p className="mb-2 text-sm font-semibold">Preview</p><RotationPreview strategy={strategy} members={selectedMembers} /></div>
      <SubmitButton>{rotation ? "Save rotation" : "Create rotation"}</SubmitButton>
    </ActionForm>
  );
}
