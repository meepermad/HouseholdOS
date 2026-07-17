import {
  Home,
  CalendarDays,
  CheckSquare,
  Wallet,
  Settings,
  Inbox,
  Package,
  Wrench,
  ScrollText,
  Ellipsis,
  UserRound,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "@/lib/nav-items";

const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  chores: CheckSquare,
  money: Wallet,
  settings: Settings,
  inbox: Inbox,
  house: Package,
  maintenance: Wrench,
  governance: ScrollText,
  more: Ellipsis,
  profile: UserRound,
  add: Plus,
  search: Search,
};

export function navIcon(key: NavIconKey): LucideIcon {
  return NAV_ICONS[key];
}
