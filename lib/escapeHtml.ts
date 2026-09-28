/**
 * Escapes special HTML characters for Leaflet's string-based popups and icons.
 *
 * Lives outside components/LeafletMap.tsx so a caller can build marker HTML
 * without importing the map — EssayView loads the map on demand, and a static
 * import of this helper from there would pull it (and Leaflet's stylesheet)
 * back into every essay page.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
