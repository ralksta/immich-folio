/**
 * The colour mode, applied before the first paint.
 *
 * The server renders the configured mode onto <html> (`data-theme`, or nothing
 * for `mode: auto`), but it cannot know a visitor's stored choice or their OS
 * setting. ThemeToggle corrects both — once its bundle has loaded and run,
 * which is after the page has already painted in the server's guess. A visitor
 * who picked light saw a dark flash on every navigation.
 *
 * This script runs synchronously in <head>, so the attribute is right before
 * the body is parsed. It must stay self-contained (it is inlined as a string)
 * and carries the CSP nonce, since `proxy.ts` allows no other inline script.
 * It is also the only thing that applies the mode on the site gate, which
 * renders without the header and therefore without ThemeToggle.
 *
 * The rules match ThemeToggle: a stored choice wins, then the configured mode
 * (`data-default-theme`), and `auto` — or no attribute at all — follows the OS.
 * Storage can throw (blocked site data); the server's attribute then stands.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,t=null;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=d.getAttribute('data-default-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}}d.setAttribute('data-theme',t)}catch(e){}})();`;
