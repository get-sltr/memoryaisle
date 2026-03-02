// Shared OAuth state — coordinates between signInWithOAuthWeb (AuthSession result)
// and callback.tsx (deep link route) so they don't race or double-exchange.
//
// Reality check:
// - On iOS, WebBrowser.openAuthSessionAsync uses ASWebAuthenticationSession which often
//   captures the redirect and returns it to JS without forwarding the deep link to the router.
//   So iOS typically exchanges in signInWithOAuthWeb using result.url.
// - On Android (and some setups), the deep link may reach Expo Router and callback.tsx can exchange.
// - Both paths must use the same exchange lock to guarantee single exchange.

let inProgress = false;
let exchanged = false;
let startedAtMs = 0;

// Treat an OAuth attempt as stale after this long (prevents "stuck inProgress").
const OAUTH_TTL_MS = 2 * 60 * 1000;

function isStale() {
  return startedAtMs !== 0 && Date.now() - startedAtMs > OAUTH_TTL_MS;
}

export const oauthState = {
  start: () => {
    inProgress = true;
    exchanged = false;
    startedAtMs = Date.now();
  },

  end: () => {
    inProgress = false;
    exchanged = false;
    startedAtMs = 0;
  },

  isInProgress: () => {
    if (inProgress && isStale()) {
      // Auto-heal if app got interrupted mid-OAuth
      inProgress = false;
      exchanged = false;
      startedAtMs = 0;
      return false;
    }
    return inProgress;
  },

  /**
   * Acquire the exchange lock. Returns true if this caller should exchange
   * the code, false if someone else already did. Prevents double exchange.
   */
  tryExchange: () => {
    if (exchanged) return false;
    exchanged = true;
    return true;
  },
};