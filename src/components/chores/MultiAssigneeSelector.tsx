"use client";

export function MultiAssigneeSelector({
  members,
  value,
  onChange,
}: {
  members: Array<{ id: string; label: string }>;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => {
        const selected = value.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((id) => id !== member.id) : [...value, member.id])}
            className={`min-h-11 rounded-md border px-3 text-sm ${
              selected ? "border-primary bg-surface-interactive text-primary" : "border-border bg-surface text-text-secondary"
            }`}
          >
            {member.label}
          </button>
        );
      })}
    </div>
  );
}
