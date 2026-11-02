# Reviews activation implementation plan

Goal: finish the existing Google/Facebook integration up to the steps that need the owner's verification, login or billing decision.

Architecture: retain the public `/api/reviews` gateway, server-only credentials and the current two review rails. Keep provider failures independent and hide absent reviews. Improve the authenticated Admin diagnostics instead of inserting placeholder credentials or publishing demo reviews.

## Tasks

- [x] Inspect live content, Vercel variable names, Google Business, Google Cloud and Meta access using Chrome.
- [x] Add failing tests for Romanian Places requests, safe empty-review diagnostics, missing credential names and correct Facebook attribution.
- [x] Request Google results using `params={"languageCode": "ro"}`. Preserve field masks and uncached Google responses.
- [x] Record review counts in `ReviewsService.integration_health`; display safe missing-variable and empty-result messages through `IntegrationsService`.
- [x] Make each card's accessible source label match its actual provider. Explain in Admin that the manual collection does not populate the external rails.
- [x] Run backend/frontend tests and a production build; exercise both rails and empty/error cases in Chromium and WebKit using isolated test data.
- [x] Write the exact activation handoff in `docs/runbooks/fireartro-reviews-activation.md`.
- [ ] Commit and push the verified changes to `fireartro/main`, then verify production.

## External facts checked on 2 November 2026

- Existing Cloud project: `vital-charger-508519-f0`, named FireArtRo Google Reviews; Places API (New) enabled.
- The project has no linked billing account and no API keys. Do not create a substitute project or start a trial/billing flow.
- Google Business lists FireArtRo as unverified and offers a real business-video verification.
- Meta for Developers redirects to Facebook login; the current Chrome session has no authenticated Meta session.
- Do not publish a guessed Place ID, create broad credentials, expose tokens in chat/Git, or insert fabricated reviews. Owner completes physical verification, billing and login; credential creation/access approval remains an explicit handoff step.

## Verification

Integrated the intervening SEO/Analytics changes through `7ade0bc` before final checks. The complete backend suite passes (511 passed, 10 integration tests skipped); frontend 70 suites / 484 tests pass; API 77 tests and public artifacts 32 tests pass. Production client and server-renderer builds pass. Eight browser scenarios pass in Chromium/WebKit, both on the client preview and when repeated against the SSR preview. The local system Python had older FastAPI/Starlette than the repository requirements; the successful backend run uses an isolated environment with the declared versions and leaves global packages unchanged. No real-provider success is claimed while credentials and owner steps are pending. Deployment evidence is recorded outside the deployable source under `output/reviews-activation/`.
