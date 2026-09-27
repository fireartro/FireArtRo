# FireArtRo Admin: proposed compact workspace

Status: recommended compact-workspace direction approved by the owner's continuation on 2026-09-27. Cross-device propagation is conditional polling, not sub-second push.

## Goal and scope

The operator must find a real record, edit it, verify a draft, and deliberately publish it. Preserve the existing authenticated FastAPI/MongoDB CMS, autosave, optimistic concurrency, immutable publication history, quotes, inbox, uploads and Blog workflows. Google/Facebook review setup remains last.

The new interface must remove promotional filler and demonstrative records, not merely hide broken or unconfigured operations. Empty collections and missing integrations must describe their actual state. Blank inputs for a new record remain legitimate controls, not invented published content.

## Alternatives

1. CSS-only compaction: low disruption, but keeps duplicated actions and the oversized navigation.
2. Compact editorial workspace over the existing CMS (recommended): preserves proven persistence and permissions, reorganizes controls, and adds automatic public revision synchronization.
3. Replace the CMS or add persistent push infrastructure: broader migration, new operational burden, and no justification for rewriting working publication/history storage. Consider push only if sub-second cross-device propagation is mandatory.

## Design contract

| Field | Decision |
| --- | --- |
| Screen job | Edit and publish actual FireArtRo content without needing code changes. |
| Primary action | Publish a saved, valid draft after reviewing exactly which modules changed. |
| Hierarchy | Current section and save status first; searchable records/editor second; advanced settings and recovery third. |
| Navigation | Four groups: Pagini, Conținut, Solicitări, Setări. Preserve old section query links with explicit mappings; do not invent routes. |
| Controls | One persistent action bar for status, preview and publish; searchable collection with real names and thumbnails; editor beside it on desktop. |
| Visual language | Existing FireArtRo dark surfaces, white text, blue active states; compact spacing, quiet borders, readable forms. No cinematic ornament inside the editor. |
| States | Loading, empty collection, validation errors, failed saves/retry, upload pending, expired session, stale draft conflict, successful publication, unavailable integration. |
| Responsive behavior | Desktop list/editor split; tablet narrower list; mobile retractable navigation and full-width editor, with a back action to the collection. Touch targets stay at least 44px. |
| Forbidden defaults | Filler slogans, fake metrics, sample collaborators presented as real, inert integration buttons, hidden client-side overrides that contradict saved CMS content. |
| Acceptance criteria | Keyboard operability and visible focus; no horizontal page overflow at 320px; valid save/publish/restore flows; conflict never overwrites an unsaved draft; another open public page updates without restarting its video. |

## Reference evidence

Browsed the public UIZZE catalogue; the observed Notion iOS references inform individual workflows, not the full desktop layout or FireArtRo branding:

- https://uizze.com/screens/244bc44fdeb649f4376c70f1cd68622e — focused search with clear empty-state guidance and cancellation. Transfer a searchable collection and explicit no-match state; do not copy Notion content or native sheet styling wholesale.
- https://uizze.com/screens/7dcbb6a40615fd72a96a8be3fad5aa4b — one property editor at a time on a small screen. Transfer focused mobile editing and a clear return action; do not copy emoji rating values or collapse all desktop fields into separate screens.
- https://uizze.com/screens/60f3e492fac185856f932b68117ac29e — restore confirmation explains scope and offers cancellation. Preserve explicit restore consequences, returning a revision to draft rather than publishing it automatically.

Desktop structure is grounded in the repository's real collection, publication and version-history workflows. These references are not evidence of usability research on FireArtRo.

## Data and synchronization proposal

MongoDB remains authoritative. Admin autosaves only a draft; a publication atomically updates the public snapshot and its revision. Do not silently switch to publish-on-every-keystroke.

On the existing Vercel serverless deployment, recommend revision checks about every five seconds while a public page is visible and online, using a lightweight revision-only response and conditional caching. Fetch and validate the full public snapshot only when the revision changes. Normal propagation target is roughly five seconds plus network time, not a guarantee during disconnection or server failure and not true push realtime.

Notify other tabs in the same browser after successful publication using a revision-only message. Never send drafts, credentials or private Admin data through this channel. Abort/deduplicate requests, back off after failures, check immediately on return to a visible tab, and preserve the last valid public content. Content updates must not remount an unchanged hero video.

If the owner requires true immediate cross-device push, stop and propose a persistent transport or managed pub/sub service with its hosting, authentication, reconnect and cost requirements before adding infrastructure.

## Canonical content migration

Inspect authenticated draft versus publication before changing content. Correct the company in siteDetails and the three legal-page identity paragraphs using the supplied certificate, preserving unrelated draft changes. Do not invent VAT status or capital social.

Migrate the real 26-partner catalogue to CMS in a targeted, reviewed publication, including the 24 verified logo assets and honest name-only entries for the two unverified marks. Then retire original-seed display substitutions without discarding uploaded or owner-edited records. Apply reviewed gallery visibility decisions to canonical managed records, with stable IDs and a recoverable publication.

## Verification and rollout

Test autosave, save races, conflicts, pending uploads, failed publication, session expiry, restore-to-draft, no-match search, collection navigation and two-tab synchronization. Verify all four navigation groups and media/Blog/quotes/inbox/history flows. Run frontend, API and artifact suites and a production build; inspect phone/tablet/desktop widths and keyboard focus. Deploy only reviewed changes and verify the actual live publication separately from the source deployment.

Current external blockers: Chrome Admin is at an expired-session login page with empty fields; owner sign-in is required. Two logo files, capital social and VAT status remain unverified. Native iOS Safari testing has not been performed.
