# Permission Model (Phase 0)

Roles: `owner` | `admin` | `member`

Enforced in:

1. Application layer (`src/lib/permissions.ts` + server actions)
2. PostgreSQL RLS policies (`supabase/migrations/*_rls_policies.sql`)

## Capability matrix

| Capability | owner | admin | member |
|---|---|---|---|
| View household | yes | yes | yes |
| Update household name/settings | yes | yes | no |
| Invite members | yes | yes | no |
| Revoke invites | yes | yes | no |
| Change member role | yes | admin/member only (no owners) | no |
| Transfer ownership | yes | no | no |
| Remove member | yes | non-owners | no |
| Leave household | no (transfer first) | yes | yes |
| Archive household | yes | no | no |
| Read audit log | yes | yes | yes |

## Notes

- Ownership transfer promotes the target to `owner`, then demotes the previous owner to `admin`.
- DB trigger requires at least one active `owner` per household.
- Invitations may only assign `admin` or `member` (never `owner`).
- Service role key is server-only (`src/lib/supabase/admin.ts`) and never exposed to the browser.
