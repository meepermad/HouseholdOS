# Permission model

Responsibilities: `member` | `household_coordinator` | `financial_coordinator`

Enforced in:

1. Application layer (`src/lib/permissions.ts` + server actions)
2. PostgreSQL RLS + security definer RPCs

## Capability matrix

| Capability | member | household_coordinator | financial_coordinator |
|---|---|---|---|
| View household | yes | yes | yes |
| Update household | no | yes | no |
| Invite / revoke | no | yes | no |
| Change member roles | no | yes | no |
| Remove member | no | yes | no |
| Leave household | yes* | yes* | yes* |
| Archive household | no | yes | no |
| Update settings | no | yes | yes |
| Read audit | yes | yes | yes |
| Create / view / confirm expenses | yes | yes | yes |
| Void / amend expenses | yes** | yes** | yes** |
| Record / view payments | yes*** | yes*** | yes*** |
| Confirm / reject / cancel / reverse payments | yes*** | yes*** | yes*** |
| Create waivers | yes*** | yes*** | yes*** |
| Open / resolve disputes | yes*** | yes*** | yes*** |

\*Last remaining `household_coordinator` must transfer responsibility before leaving.

\*\*Draft edit/confirm/void/amend still require the caller to be the expense creator, payer, or (for void/amend RPCs) an active member with access — financial coordinators do **not** silently rewrite confirmed expenses outside the void/amend RPCs. Draft visibility: creator/payer always; others from `ready_for_review` onward.

\*\*\*App capabilities are granted to all active roles; **party checks are enforced in RPCs**:
- Only the **debtor** may submit a payment toward their obligations.
- Only the **recipient** may confirm or reject a submitted payment.
- Only the **sender** may cancel a submitted payment before recipient action.
- Only the **confirming recipient** may reverse a confirmed payment through the reverse RPC (senders request reversal via dispute).
- Only the **creditor** may create a waiver; the debtor cannot waive their own debt.
- Coordinator status alone does **not** grant silent edits of payment history.

## Payment visibility

Active household members may see public payment fields (parties, amount, method category, status, claimed date, public note, allocations, related expenses).

Only the payment **sender and recipient** may select `payment_private_details` (private note, external reference). This is enforced with RLS, not UI-only hiding.

## Notes

- Creator receives all three responsibilities (no global admin).
- Invitation intended roles may include coordinators; acceptance is transactional.
- Audit events are append-only for ordinary users.
- Confirmed expenses are immutable except via `confirm_expense` / `void_expense` / amendment RPCs.
- Payments, allocations, waivers, and reversals are RPC-only writes.
