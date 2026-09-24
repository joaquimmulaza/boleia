## 2024-05-18 - [Cache Intl Instantiations]
**Learning:** `Date.prototype.toLocaleDateString()` and `Number.prototype.toLocaleString()` implicitly create an expensive `Intl` instance every time they are called.
**Action:** Use a globally cached `Intl.DateTimeFormat` or `Intl.NumberFormat` instance with `.format()` instead.
