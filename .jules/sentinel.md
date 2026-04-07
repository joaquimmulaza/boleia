## 2024-04-07 - Sanitize tel URI schemes

**Vulnerability:** URI Injection in `tel:` links.
**Learning:** Raw phone numbers were passed to `href="tel:${phoneNumber}"`. If this value were user-controlled and not properly validated, malicious URI schemes or characters could be injected. Although React protects against `javascript:` by default, malformed tel structures can break link behavior across devices.
**Prevention:** Always sanitize input for URL schemes. For `tel:` links, stripping all non-digits and non-plus characters (e.g. using `.replace(/[^\d+]/g, '')`) ensures a valid format and adds defense in depth.
