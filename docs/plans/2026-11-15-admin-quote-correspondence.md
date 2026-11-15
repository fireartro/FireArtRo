# FireArtRo Admin quote correspondence

The Admin inbox will list saved form requests and received mail in one date-ordered view. A form request remains a quote in MongoDB; its inbox ID uses the reserved `quote-` prefix. The quote filter hides requests marked as spam. Only the authenticated operator can send a reply, to the address stored on the quote. The first reply has no fabricated email thread headers. Reply history uses the existing durable send records.

New quote notifications will use a compact branded HTML layout plus a text alternative. An Admin link opens the exact quote under Mesaje. Each notification keeps the template used at its first provider attempt so that recovery can reuse the same Resend request.

- [ ] Verify that an existing quote appears in Mesaje without copying it, that the quote filter and chronological paging work, and that inbox details never include internal notes or private provider identifiers.
- [ ] Exercise the real Admin reply routes with an injected mail transport: reject unauthenticated, CSRF, spam, and recipient override attempts; persist and display replies and reuse the same send identity after an interruption.
- [ ] Render the new notification with synthetic input. Verify long and hostile text, optional fields, the exact Admin link, and preservation of the old payload for recovery.
- [ ] Test the production build's Admin workflows on desktop, tablet, and phone with a disposable local database and synthetic content. Check authentication, quote status, email and quote correspondence, CMS draft and preview, publish and revisions, and operational modules.
- [ ] Use the protected GitHub and Vercel release path. Verify the real email paths only with the owner's authorized test address and clearly marked synthetic content. Keep the live customer's request untouched.
