## 2024-05-24 - [Vercel Security Headers]
**Vulnerability:** Missing basic security headers (X-Frame-Options, X-Content-Type-Options, etc.)
**Learning:** For a single-page app hosted on Vercel, security headers should be configured globally in `vercel.json` to defend against clickjacking, MIME-type sniffing, and to enforce HTTPS for all pages.
**Prevention:** Include a comprehensive "headers" block in `vercel.json` for new web applications on Vercel to establish a secure baseline from the start.
