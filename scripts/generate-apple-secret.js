/**
 * Generate Apple Client Secret JWT for Sign In with Apple
 *
 * Usage: node generate-apple-secret.js
 *
 * You need to update the values below with your Apple credentials.
 */

const crypto = require('crypto');

// ===== UPDATE THESE VALUES =====
const TEAM_ID = 'A2RL4W62BR';
const KEY_ID = 'V6UKKQYURX'; // From Apple Developer - the Key ID you created
const SERVICE_ID = 'com.memoryaisle.app.web'; // Your Services ID

// Load your .p8 private key from a file (NEVER commit keys to git)
const fs = require('fs');
const P8_PATH = process.env.APPLE_P8_PATH || './AuthKey.p8';
if (!fs.existsSync(P8_PATH)) {
  console.error(`\nERROR: Private key file not found at ${P8_PATH}`);
  console.error('Set APPLE_P8_PATH env var or place AuthKey.p8 in this directory.\n');
  process.exit(1);
}
const PRIVATE_KEY = fs.readFileSync(P8_PATH, 'utf8').trim();
// ================================

function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (86400 * 180); // 180 days (max 6 months)

  const header = {
    alg: 'ES256',
    kid: KEY_ID,
    typ: 'JWT'
  };

  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp: expiry,
    aud: 'https://appleid.apple.com',
    sub: SERVICE_ID
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(PRIVATE_KEY);

  // Convert DER signature to raw r||s format for ES256
  const derSignature = signature;
  let offset = 3;
  const rLength = derSignature[offset];
  offset += 1;
  let r = derSignature.slice(offset, offset + rLength);
  offset += rLength + 1;
  const sLength = derSignature[offset];
  offset += 1;
  let s = derSignature.slice(offset, offset + sLength);

  // Ensure r and s are 32 bytes each
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  if (r.length < 32) r = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  if (s.length < 32) s = Buffer.concat([Buffer.alloc(32 - s.length), s]);

  const rawSignature = Buffer.concat([r, s]);
  const encodedSignature = rawSignature.toString('base64url');

  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  console.log('\n=== Apple Client Secret JWT ===\n');
  console.log(jwt);
  console.log('\n=== Copy the above JWT to Supabase ===\n');
  console.log('This token expires in 180 days. Set a reminder to regenerate it!\n');

  return jwt;
}

generateAppleClientSecret();
