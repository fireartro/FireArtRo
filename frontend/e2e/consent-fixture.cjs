async function mockConsentLedger(page) {
  await page.route('**/api/consent', route => {
    const { id, version, analytics, marketing, retentionDays, contentRevision, method } = route.request().postDataJSON();
    return route.fulfill({ json: {
      id, version, analytics, marketing, contentRevision, method,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + retentionDays * 86_400_000).toISOString(),
    } });
  });
  await page.route('**/api/consent/withdraw', route => route.fulfill({ status: 204 }));
}

module.exports = { mockConsentLedger };
