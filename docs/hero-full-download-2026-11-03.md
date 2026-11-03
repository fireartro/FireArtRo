# Complete hero chapter downloads

The homepage keeps its three complete films. On constrained connections,
native `canplay`/readyState describes a buffer, not the complete file; entering
the homepage on that signal allowed repeated network stalls. The startup
overlay now waits for a complete first-chapter download and decodable frames.

`src/lib/heroDownloadCache.js` is a small universal module shared by React and
the early startup script. The build copies the exact tested implementation to
`public/hero-download-cache.js`, loaded before `startup-intro.js`.

The transfer order is:

1. Select the existing orientation/quality playlist and fetch chapter1.
2. Consume its entire response body, reject non-200/partial responses and
   unexpected media types, validate Content-Length when available, then create
   its local Blob URL. No playable URL exists before complete body receipt.
3. Decode the local film; dismiss loading and start playback from the beginning.
4. The first `playing` event queues chapter2, then chapter3. Only one media
   fetch runs at a time. Repeated player events reuse the same requests/Blobs.
5. Switch at a chapter ending only when the next complete file is ready. If
   it needs more time, replay the fully downloaded current chapter. Playback
   does not start a partial next file or freeze waiting for its network buffer.

The existing loading line reports actual first-file download progress. Poster,
eight-second timeout and manual skip cannot bypass the default montage's
complete-file gate. A transfer error offers retry and keeps chapter ordering.
Custom CMS videos, interior pages, reduced motion and explicit data saving
retain their appropriate existing startup behavior.

Pending requests abort on route/playlist changes or explicit autoplay-policy
disable. Completed Blob URLs are revoked when their cache is disposed. Media
errors can evict and refetch a bad Blob using a fresh HTTP request; decoder
retries are bounded before the existing unsupported-video fallback. Playback
position is retained during recovery and orientation/quality changes.

The complete-file requirement deliberately makes the initial loading period
longer on 3G. A roughly6MiB file cannot be fully downloaded in a few seconds
on a1Mbps connection. The smaller renditions remain in use, and playback
starts after the actual transfer rather than after an arbitrary short timer.
Do not bypass this behavior for Lighthouse or any particular user agent.

Verification includes deferred-body/cache/queue/cancellation tests, strict
startup gating beyond30seconds, partial-response rejection, original three-film
order, cached-loop behavior, recovery and policy cleanup. Browser verification
uses the current SSR build at390×844/DPR3 with1Mbps bandwidth and400ms latency.
