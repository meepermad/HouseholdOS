import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/apply-dom";

/** Blocking script before first paint — prevents wrong-theme flash. */
export function ThemeBootstrapScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
    />
  );
}
