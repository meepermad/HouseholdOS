# LifeOS calendar integration contract

**Version:** `1.0.0`  
**Access:** Read-only by default · Explicit user authorization · Revocable · Calendar-scoped

HouseholdOS does **not** grant LifeOS (or any external system) service-role access to household data. Integration is user-authorized and audited.

## Authorization

1. A household member creates a feed token with `purpose = lifeos` under **Settings → Integrations → Calendar**.
2. Tokens are stored as hashes only (`calendar_feed_tokens.token_hash`).
3. Optional `calendar_ids[]` scopes the feed to selected calendars.
4. `include_private` defaults to `false`. Private event details are never included unless the owner explicitly opts in for their own private events.
5. Tokens may be rotated or revoked at any time; revocation is immediate for new requests.

## Transport

| Method | Endpoint | Notes |
|---|---|---|
| ICS subscribe | `GET /api/calendar/feed/{token}.ics` | `text/calendar`, `Cache-Control: private, no-store` |
| Contract fields | See `LifeOsCalendarEvent` in `src/lib/calendar/lifeos-contract.ts` | Maps from feed events |

## Event fields

| Field | Description |
|---|---|
| `contractVersion` | `1.0.0` |
| `eventId` / `stableUid` | Stable HouseholdOS identifiers |
| `startsAt` / `endsAt` | Timed instants (ISO-8601) |
| `startDate` / `endDateExclusive` | All-day floating dates (not UTC instants) |
| `timeZone` | IANA identifier |
| `rrule` | RFC 5545 when present |
| `status` | `scheduled` \| `cancelled` |
| `visibilitySafeTitle` | May be `Busy` for private projections |
| `sourceType` / `sourceId` | Domain provenance when authorized |
| `deepLink` | In-app path to the event |
| `lastModified` / `sequence` | Change detection / incremental sync hints |

## Security rules

- Never put secrets in URL paths beyond the high-entropy token.
- Do not expose amounts, private notes, or attachment storage paths in feeds.
- Coordinators cannot read another member’s OAuth tokens or private event content.
- Write-back from LifeOS is **out of scope** for contract `1.0.0`.

## Verification honesty

Automated tests cover token scoping, busy projection, and ICS serialization. Live LifeOS client verification is reported separately when performed.
