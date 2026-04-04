## 2025-02-18 - [Prevent Parameter Injection in URI Schemes]
**Vulnerability:** Untrusted variables (`phoneNumber`, `acordo.id`) were directly interpolated into URI schemes (`href="tel:${phoneNumber}"` and `href="mailto:...?subject=...${acordo.id}"`) without URL-encoding.
**Learning:** React prevents XSS natively in DOM elements but it doesn't parse custom URI schemes to encode parameters. This allowed potential parameter/scheme injection.
**Prevention:** Always use `encodeURIComponent()` to sanitize variables dynamically added to `tel:`, `mailto:`, or similar custom URI schemes.
