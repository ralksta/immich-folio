1. **Add accessibility to the Lightbox Counter**
   - Update `components/Lightbox.tsx` to wrap the counter in a live region for screen readers.
   - Use `aria-live="polite"` and `aria-atomic="true"`.
   - Include a visually hidden span (`className="sr-only"`) with context-rich text ('Photo X of Y').
   - Hide the raw numerical text (`X / Y`) from screen readers with `aria-hidden="true"`.
2. **Verify changes**
   - Run `pnpm exec eslint components/Lightbox.tsx` and `pnpm test` to ensure no regressions in modified files.
3. **Log learning**
   - Append the learning regarding the Lightbox Counter ARIA live region to `.Jules/palette.md` using `cat << 'EOF' >> .Jules/palette.md`.
   - Verify the learning was appended properly.
4. **Complete pre-commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
5. **Submit the PR**
   - Submit the branch with "🎨 Palette: Add accessible live region to Lightbox counter" and PR details.
