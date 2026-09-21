## 2025-09-20 - [Form Autocomplete Security Enhancement]
**Vulnerability:** Authentication form inputs (email, password, etc.) lacked proper `autoComplete` attributes.
**Learning:** Without correct `autoComplete` hints, password managers may fail to securely save or fill credentials, degrading user security and increasing the risk of weak passwords or phishing.
**Prevention:** Always include standard `autoComplete` attributes (e.g., `current-password`, `new-password`, `email`) on all authentication forms to support secure password managers.
