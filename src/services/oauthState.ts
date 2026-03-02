// Shared OAuth state — coordinates between signInWithOAuthWeb (landing.tsx)
// and callback.tsx so they don't race each other.
//
// Architecture:
//   - ONLY callback.tsx calls exchangeCodeForSession (single exchanger)
//   - Exchange lock prevents double exchange from useEffect re-runs
//   - signInWithOAuthWeb polls for the session that callback.tsx establishes
//   - When inProgress: callback.tsx defers navigation to landing.tsx
//   - When !inProgress: cold-start deep link, callback.tsx handles independently

let inProgress = false;
let exchanged = false;

export const oauthState = {
  start: () => {
    inProgress = true;
    exchanged = false;
  },
  end: () => {
    inProgress = false;
    exchanged = false;
  },
  isInProgress: () => inProgress,

  /**
   * Acquire the exchange lock. Returns true if this caller should exchange
   * the code, false if someone else already did. Prevents double exchange
   * from useEffect re-runs or race conditions.
   */
  tryExchange: () => {
    if (exchanged) return false;
    exchanged = true;
    return true;
  },
};
