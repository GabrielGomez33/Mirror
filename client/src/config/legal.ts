/**
 * Legal document versioning — single source of truth.
 *
 * Both the Terms & Conditions page (/termsandconditions) and the consent
 * pipeline (registration checkbox + ConsentGate re-prompt) import these
 * constants so the accepted version recorded in the database always
 * matches the version the user actually saw.
 *
 * When the terms change materially:
 *   1. Bump TERMS_VERSION (e.g. 'v1.0' -> 'v1.1').
 *   2. Update TERMS_EFFECTIVE_DATE.
 *   3. Add a changelog line in TermsPage's footer.
 * The ConsentGate will then detect the mismatch and re-prompt every user
 * to accept the new version on their next authenticated page load.
 */

export const TERMS_VERSION = 'v1.0';
export const TERMS_EFFECTIVE_DATE = '2026-05-25';

/**
 * Router path (basename-relative). Use with react-router <Link to={TERMS_PATH}>,
 * which prefixes the app basename ("/Mirror") automatically.
 */
export const TERMS_PATH = '/termsandconditions';

/**
 * Absolute href including the Vite/app base ("/Mirror/"). Use this for plain
 * <a href> tags (e.g. target="_blank" new-tab links), which do NOT know about
 * the router basename and would otherwise resolve to the origin root and 404.
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
export const TERMS_HREF = `${BASE}/termsandconditions`;

/** Minimum age required to use Mirror (see Terms §1). */
export const MINIMUM_AGE = 16;