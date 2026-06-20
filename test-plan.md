1. **Fix missing aria-labels on icon-only buttons**
   - In `app/admin/components/PageBuilder.tsx`, update the buttons containing text characters (like `×` and `✕`) to use an accessible `aria-label` while wrapping the visual text in an `aria-hidden` `span`. Specifically, update the Clear search button, the Collapse button, and the Delete subpage button (`🗑`). Also ensure the remove section and close details buttons (which use `<Icons.Close />`) have `aria-label`s.
   - In `app/admin/components/AssetPicker.tsx` and `app/admin/components/AlbumPicker.tsx`, update the close button (`×`) to have an accessible `aria-label` and `aria-hidden` text.

2. **Run tests & verification**
   - `pnpm lint`
   - `pnpm test`
   - Ensure the application builds properly.
