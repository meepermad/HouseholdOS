import {
  Bell,
  CalendarDays,
  HeartPulse,
  Moon,
  Package,
  UserRound,
  UtensilsCrossed,
  Wrench,
  ScrollText,
  Users,
} from "lucide-react";
import { assertActiveMembership } from "@/lib/household-context";
import { SettingsList, SettingsRow } from "@/components/ui/settings-list";

export const dynamic = "force-dynamic";

export default async function SettingsHubPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const base = `/app/${householdId}/settings`;
  const showOps = ctx.roles.includes("household_coordinator");

  return (
    <main className="space-y-6" data-testid="settings-hub">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Personal preferences and household configuration.
        </p>
      </section>

      <div className="space-y-4">
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Personal
          </h2>
          <SettingsList ariaLabel="Personal settings">
            <SettingsRow
              href={`${base}/profile`}
              label="Profile"
              description="Name, timezone, and locale"
              icon={UserRound}
              testId="settings-row-profile"
            />
            <SettingsRow
              href={`${base}/notifications`}
              label="Notifications"
              description="Quiet hours and delivery"
              icon={Bell}
            />
            <SettingsRow
              href={`${base}/profile#appearance`}
              label="Appearance"
              description="Light, dark, or system"
              icon={Moon}
              value="Theme"
            />
          </SettingsList>
        </div>

        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Household
          </h2>
          <SettingsList ariaLabel="Household settings">
            <SettingsRow
              href={`${base}/household`}
              label="Household"
              description="Name, policies, and setup"
              icon={Users}
            />
            <SettingsRow
              href={`${base}/members`}
              label="Members"
              description="Invite and manage roles"
              icon={Users}
            />
            <SettingsRow
              href={`${base}/calendar`}
              label="Calendar"
              description="Defaults and integrations"
              icon={CalendarDays}
            />
            <SettingsRow
              href={`${base}/meals`}
              label="Meals"
              description="Meal planning preferences"
              icon={UtensilsCrossed}
            />
            <SettingsRow
              href={`${base}/house-resources`}
              label="House resources"
              description="Inventory and supplies"
              icon={Package}
            />
            <SettingsRow
              href={`${base}/chores`}
              label="Chores"
              description="Defaults and reminders"
              icon={HeartPulse}
            />
            <SettingsRow
              href={`${base}/maintenance`}
              label="Maintenance"
              description="Reporting preferences"
              icon={Wrench}
            />
            <SettingsRow
              href={`${base}/governance`}
              label="Governance"
              description="Document defaults"
              icon={ScrollText}
            />
            {showOps ? (
              <SettingsRow
                href={`${base}/operations`}
                label="Operations health"
                description="Worker and delivery status"
                icon={HeartPulse}
              />
            ) : null}
          </SettingsList>
        </div>
      </div>
    </main>
  );
}
