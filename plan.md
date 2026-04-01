1. **Security Enhancement: Prevent email header/body injection in `mailto:` links.**
   - Modify `src/pages/MyAgreements.jsx` to wrap `acordo.id` with `encodeURIComponent` when constructing the `mailto:` URL in `handleReport`.
   - Update `src/components/AcordoDetailsModal.jsx` to wrap `phoneNumber` with `encodeURIComponent` when constructing the `tel:` link URL.

2. **Complete pre commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3. **Submit the change.**
   - Submit the change with a descriptive commit message following the required structure.
