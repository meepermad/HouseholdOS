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

\*Last remaining `household_coordinator` must transfer responsibility before leaving.

\*\*Draft edit/confirm/void/amend still require the caller to be the expense creator, payer, or (for void/amend RPCs) an active member with access — financial coordinators do **not** silently rewrite confirmed expenses outside the void/amend RPCs. Draft visibility: creator/payer always; others from `ready_for_review` onward.

## Notes

- Creator receives all three responsibilities (no global admin).
- Invitation intended roles may include coordinators; acceptance is transactional.
- Audit events are append-only for ordinary users.
- Confirmed expenses are immutable except via `confirm_expense` / `void_expense` / amendment RPCs.
