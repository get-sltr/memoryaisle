// Shared OAuth state — coordinates between signInWithOAuthWeb (landing.tsx)
// and callback.tsx so they don't race each other.
//
// When landing.tsx starts an OAuth flow, it sets inProgress = true.
// callback.tsx checks this flag:
//   - If true: exchange the code but DON'T navigate (let landing.tsx handle it)
//   - If false: this is a cold-start deep link, handle everything independently

let inProgress = false;

export const oauthState = {
  start: () => {
    inProgress = true;
  },
  end: () => {
    inProgress = false;
  },
  isInProgress: () => inProgress,
};
