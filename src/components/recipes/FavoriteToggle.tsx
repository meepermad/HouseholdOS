"use client";

export function FavoriteToggle({
  name = "isFavorite",
  defaultChecked = false,
  id = "isFavorite",
  label = "Mark as favorite",
}: {
  name?: string;
  defaultChecked?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-primary"
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-border accent-primary"
      />
      {label}
    </label>
  );
}
