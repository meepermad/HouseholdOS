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
| Invite / revoke (join this household) | no | yes | no |
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
| View / create calendar events | yes | yes | yes |
| RSVP / update own guest count | yes | yes | yes |
| Edit / cancel own events | yes | yes | yes |
| Invite / view availability / manage own integrations | yes | yes | yes |
| Manage household calendars & resources | no | yes | no |
| Coordinator calendar override (household-visible only) | no | yes**** | no |
| Manage own calendar feed tokens | yes | yes | yes |
| View / create chores | yes | yes | yes |
| Complete / claim assigned chores | yes | yes | yes |
| Manage rotations / household recurring systems | no***** | yes***** | no |
| Coordinator chore override | no***** | yes***** | no |
| Manage responsibility areas / transfers | limited****** | yes | no |
| Guest notices / away status / polls (member-scoped) | yes | yes | yes |
| Emergency card view | yes******* | yes | yes |
| Emergency card edit | no | yes | no |
| Global search | yes (RLS) | yes (RLS) | yes (RLS) |
| View / create house resources (inventory, supplies, pantry, shopping) | yes******* | yes | yes |
| Update stock / claim shopping / link expense items | yes******* | yes | yes******* |
| Coordinator resource override (communal + ownership transfer) | no******* | yes | no |
| View notification worker health (Settings → Operations) | no | yes | no |

\*Last remaining `household_coordinator` must transfer responsibility before leaving.

### Platform registration issuers

Independent `create_household` registration invitations are **not** granted by household membership. Authorization is either:

1. Email listed in `platform_registration_issuers`, or
2. Exact match to `auth_registration_policy.bootstrap_email`

Household coordinators cannot issue these grants unless they are also on that allowlist (or are the bootstrap email). Join-household invitations remain coordinator-scoped and unchanged.

\*\*Draft edit/confirm/void/amend still require the caller to be the expense creator, payer, or (for void/amend RPCs) an active member with access — financial coordinators do **not** silently rewrite confirmed expenses outside the void/amend RPCs. Draft visibility: creator/payer always; others from `ready_for_review` onward.

\*\*\*App capabilities are granted to all active roles; **party checks are enforced in RPCs**:
- Only the **debtor** may submit a payment toward their obligations.
- Only the **recipient** may confirm or reject a submitted payment.
- Only the **sender** may cancel a submitted payment before recipient action.
- Only the **confirming recipient** may reverse a confirmed payment through the reverse RPC (senders request reversal via dispute).
- Only the **creditor** may create a waiver; the debtor cannot waive their own debt.
- Coordinator status alone does **not** grant silent edits of payment history.
- **Routed settlements:** only the **payer** may create a binding proposal. Confirmed-route correction requires the three participants (recipient confirms external return; payer and intermediary approve). A financial coordinator may *request* an administrative correction but cannot unilaterally restore obligations while leaving the linked payment confirmed. Opening-balance **reverse** is not implemented (schema status reserved only).
- **Polls:** creator or household coordinator manages; ordinary members cannot edit others’ polls. Anonymous polls do not expose other members’ vote identity through vote rows or aggregates.
- **Exports:** coordinator status does not override personal pantry/recipe privacy. Export job metadata is limited to the requester and household coordinators.
- **Opening-balance children** (approvals/events/import links) inherit parent entry visibility.
- **Shopping-intelligence children** inherit parent recommendation/suggestion visibility (viewer-scoped rediscovery).
- Roommate ops (purchases, packages, meetings, directory, parking) are **beta** until full lifecycle suites pass; updates require creator/owner/coordinator.

\*\*\*\*`household_coordinator` may cancel or update **household-visible** operational events through an audited `coordinator_override` path. Coordinator override is **refused** for `participants` and `private_busy` events. `financial_coordinator` has no special calendar authority. Organizer identity is always derived from `auth.uid()` membership — callers cannot name another organizer.

\*\*\*\*\*`financial_coordinator` gains **no** chore authority beyond ordinary member capabilities. Assignees may update their own progress and complete assigned work. Only organizers/coordinators may change recurrence or rotation. All coordinator overrides are audited. Completion history cannot be silently rewritten.

\*\*\*\*\*\*Any active member may create a responsibility area they will own; transfers require the current owner (or coordinator) to request and the new owner to accept unless a coordinator assigns explicitly through an audited path.

\*\*\*\*\*\*\*`financial_coordinator` gains **no** physical inventory override. Personal `owner_only` pantry/inventory is **not** bypassed by coordinator status. Expense linkage requires same-household expense visibility plus `resource.link_expense`. Ownership transfers for personal items require the owner or an audited `resource.coordinator_override`.

## Meals and recipes

| Capability | member | household_coordinator | financial_coordinator |
|---|---|---|---|
| View visible recipes / meal plans | yes | yes | yes |
| Create personal or household recipes / meal plans / requests | yes | yes | yes |
| Import a public recipe URL for private review | yes | yes | yes |
| Edit own recipe / organize own meal | yes | yes | yes |
| Archive household-visible recipes | creator | creator or coordinator | creator |
| Read/edit creator-only recipes of others | no | **no** | no |
| Update only own meal attendance | yes | yes | yes |
| Confirm shopping prep / mark prepared (organizer) | organizer | organizer | organizer |
| Update meal settings (staples / shopping-prep policy) | no | yes | no |

Personal dietary preferences are owner-only. Meal organizers see aggregated constraint summaries unless a member opted to share identity. Meal expense suggestions do not grant financial authority — purchasers confirm through existing expense RPCs. Pantry matching never reveals unauthorized personal pantry quantities.

Recipe import uses `meal.create`. An unfinished import draft is visible only to
the active membership that requested it; household coordinators do not bypass
this privacy boundary. Once approved, existing recipe visibility and RLS are
authoritative.

Personal recipe preference and feedback rows are owner-only. Recommendation
scoring may use attendee preferences internally, but organizers receive
anonymized explanations only. Coordinators do not bypass preference privacy.

## Shopping recommendations and Forgotten Favorites

| Capability | member | household_coordinator | financial_coordinator |
|---|---|---|---|
| Generate / review shared shopping recommendations | yes | yes | yes |
| Add recommended items to an authorized list | yes (via existing shopping RPCs) | yes | yes |
| Dismiss / snooze / suppress a suggestion | yes | yes | yes |
| Start / complete shopping trip mode | yes | yes | yes |
| View Forgotten Favorites in shared context | yes (household-visible recipes only) | yes | yes |
| Update shopping / rediscovery household prefs | no | yes | no |
| See personal pantry quantities in shared recs | **no** | **no** | **no** |
| See creator-only recipes of others in rediscovery | **no** | **no** | **no** |

Shared recommendation runs use only household-visible source data. Personal shopping requests and personal pantry stay scoped to authorized members. Recommendation counts must not leak hidden items. Preference explanations stay anonymized (`Preference fit: Strong` / participant-count wording). Final list mutations always go through existing shopping and meal shopping-prep RPCs.

## Maintenance

| Capability | member | household_coordinator | financial_coordinator |
|---|---|---|---|
| `maintenance.view` | yes | yes | yes |
| `maintenance.create` | yes | yes | yes |
| `maintenance.manage_own` | yes | yes | yes |
| `maintenance.coordinator_override` | no | yes | **no** |
| `governance.view` | yes | yes | yes |
| `governance.create` | yes | yes | yes |
| `governance.edit_own_draft` | yes | yes | yes |
| `governance.propose` | yes | yes | yes |
| `governance.comment` | yes | yes | yes |
| `governance.approve` | yes | yes | yes |
| `governance.activate` | no | yes | no |
| `governance.archive` | no | yes | no |
| `governance.manage_templates` | no | yes | no |
| `governance.manage_transitions` | no | yes | no |
| `governance.coordinator_override` | no | yes | **no** |

Maintenance expense links require same-household expenses and existing financial permissions. Linking does not confirm or allocate an expense. Private evidence is limited to viewers authorized for the request; raw storage paths are not placed in notifications.

## Calendar visibility

| Visibility | Who sees full details | Others see |
|---|---|---|
| `household` | All active members | Full details |
| `participants` | Organizer + invited attendees | Hidden (no row for nonparticipants via participant checks) |
| `private_busy` | Organizer (+ attendees if invited) | Generic **Busy** block only (no title/location/notes/guests/reminder details). Occurrence overrides cannot bypass master privacy. |

## Chore visibility

| Visibility | Who sees full details | Others see |
|---|---|---|
| `household` | All active members | Full chore + status |
| `assignees` | Creator, assignees, relevant coordinators | Generic workload indicator only when necessary |

Sensitive completion notes follow the same visibility as the chore. Photo evidence is not shipped in Phase 5.

Feed tokens are per-user and per-household. Scope `visible_to_me` exports events the owner may fully view; `household_public_only` exports household-visible events only. Raw tokens are shown once at create/regenerate; only hashes are stored. Feed responses use `Cache-Control: private, no-store`. Feed access ends when membership is no longer active or the token is revoked.

## Notifications

| Capability | Rule |
|---|---|
| Read own `user_notifications` | Owner only (`user_id = auth.uid()`) |
| Mark read / unread / all read | Owner only via RPCs |
| List own devices | Safe view `push_subscription_devices` (no endpoint/keys) |
| Subscribe / unsubscribe push | Owner only; RPCs bind `auth.uid()` |
| Read another member’s push endpoint | Denied |
| Edit notification preferences / quiet hours / preview mode | Owner only |
| Read `notification_events` | Active household members (routing metadata only) |
| Read own delivery status rows | Owner SELECT; no claim/update |
| Claim / complete / fail deliveries | `service_role` worker RPCs only |
| Enqueue test notification | Authenticated owner; rate-limited |

Push endpoints are capability URLs — never placed in notification payloads or audit details.

## Receipts (launch)

| Capability | Rule |
|---|---|
| Upload receipt | Active member; storage path must be `{householdId}/…` |
| View receipt draft / OCR / line items / signed URL | Uploader, financial coordinator, or (when linked) expense creator / payer / allocation participant via `can_view_expense_receipt` |
| Edit / confirm receipt as draft expense | Uploader or financial coordinator via `can_edit_expense_receipt` |
| Unrelated active member | Denied for unconfirmed drafts and private OCR payloads |
| Removed / other-household member | Denied |
| Claim / complete OCR jobs | `service_role` + `DOCUMENT_JOB_WORKER_SECRET` HTTP worker only |

## Record comments (launch)

| Capability | Rule |
|---|---|
| List / add comment | Must `can_view_comment_parent` **and** `can_comment_on_parent` for the same household — membership alone is insufficient |
| Edit comment | Author within 15-minute edit window; parent must still be visible |
| Soft-delete comment | Author or household coordinator; parent must still be visible |
| Change parent lifecycle via comment | Forbidden |

## Payment visibility

Active household members may see public payment fields (parties, amount, method category, status, claimed date, public note, allocations, related expenses).

Only the payment **sender and recipient** may select `payment_private_details` (private note, external reference). This is enforced with RLS, not UI-only hiding.

## Monthly Household Review

| Action | Who |
|---|---|
| View meetings / shared packets / recaps | Active household members |
| View personal addendum | Only the owning membership |
| Create / gather / lock / start / complete / publish | Organizer or household coordinator |
| Accept / dismiss suggested agenda | Organizer or household coordinator |
| Record notes / decisions / action items during meeting | Active participants (meeting in progress or completed) |
| Bypass source-domain privacy via meeting packet | Forbidden — projections only include authorized data |

Meeting writes are RPC-only. Coordinators do not automatically receive other members' personal addenda.

## Notes

- Creator receives all three responsibilities (no global admin).
- Invitation intended roles may include coordinators; acceptance is transactional.
- Audit events are append-only for ordinary users.
- Confirmed expenses are immutable except via `confirm_expense` / `void_expense` / amendment RPCs.
- Payments, allocations, waivers, and reversals are RPC-only writes.
- ******* Emergency card visibility may be restricted to coordinators; Wi-Fi and similar fields are never placed in notification payloads or public caches.
