# FireArtRo

## Verify changes in Admin and on the site

- For every change, identify the affected public routes and the corresponding sections of the authenticated `/admin` workspace. Check the affected Admin section after the change, even when the implementation was only on the public site. For shared components, check every affected route. If a change has no Admin surface, record that explicitly.
- For editable content, verify the complete flow in an isolated environment with test data: open the editor, change and save the draft, reload, open the page in Admin Preview, and compare it with the public page after an isolated publication. Check whether the editor controls the content visitors actually see. Identify content fixed in code and integrations controlled outside the CMS.
- For responsive changes, check Admin Preview at Desktop (1440 × 900), Tabletă (834 × 1112) and Telefon (390 × 844), plus the matching public views. For integrations, verify the available, unconfigured and failure states.
- Keep production drafts and published data out of edit tests. Record the routes, Admin sections, environment and results. State any check that could not be completed before marking the work done.
