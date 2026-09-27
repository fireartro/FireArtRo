# Company identity publication

> Execute the owner's requested data correction, not a redesign or an authentication bypass.

**Goal:** publish the certificate identity in the real CMS, preserving unrelated published content and unpublished owner edits. Commit and push the verified correction.

**Confirmed data:** 1A FIREARTRO EVENTS S.R.L.; CUI 43337078; J12/3784/16.11.2020; registered office Strada Oltului nr. 1, camera nr. 1, et. 1, ap. 4, Cluj-Napoca, județul Cluj, România. The owner's separate operational address is Piața Unirii nr. 2, Seini, județul Maramureș. Capital and VAT registration are not supplied and must not be invented.

## Tasks

- [ ] Verify existing Admin session and project credential files. Recover only an existing credential; do not guess passwords, mint sessions, change credentials, or bypass browser security or Google confirmation.
- [ ] Write failing tests in `backend/tests/test_company_identity_migration.py`: certificate identity in a legacy snapshot; no unknown capital/second operational office; preservation of unrelated text/media; idempotence; unrelated identity refusal; atomic publication/draft/history; rollback on conflict; no repeat after later owner edits.
- [ ] Implement `backend/content_migrations.py`: a narrowly guarded, one-time Mongo transaction for the known legacy identity, with an immutable revision and independent draft correction. Never publish unrelated draft edits or rewrite old history. Preserve operational-address edits and a current owner draft's base revision when it did not track the old publication.
- [ ] Make missing-draft recovery in `backend/cms_repository.py` transactionally read and lock the current publication, so an old snapshot cannot race with the correction. Refresh the recovery envelope's publication metadata in `backend/cms_service.py`.
- [ ] Call the migration in `backend/server.py` during Production startup only. No new HTTP route or relaxed Admin authentication. Failed migrations roll back and log only a safe generic message.
- [ ] Remove the unconfirmed secondary operational office from bundled defaults. The registered office remains visible under its proper label.
- [ ] Run backend, frontend, API and production-artifact checks. Review the migration's concurrency and rollback behavior before merging.
- [ ] Commit explicit changed paths, push a `codex/` branch, merge through protected-main checks, and verify the production legal pages and footer in Chrome. Leave unrelated owner assets untracked.

## Implementation constraints

The CMS remains the public source of truth. The correction is persisted in MongoDB, not applied as a frontend fallback or forced on every render. Future Admin edits remain authoritative. Only the previous CUI 46367383 and normalized 1A SMART LAND SOLUTIONS SRL identity are eligible for automatic correction. The fixed migration revision is also its one-time completion marker. Changing the identity in the public snapshot and draft must happen together, but each content object is transformed independently. Tests use the real migration function with deterministic database doubles for external MongoDB operations.
