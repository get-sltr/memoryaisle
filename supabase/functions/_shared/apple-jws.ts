// Apple JWS Signature Verification
// Verifies Apple's JWS (JSON Web Signature) payloads by:
//   1. Validating the x5c certificate chain against Apple Root CA - G3
//   2. Verifying the JWS signature using the leaf certificate's public key
//
// Apple signs App Store Server Notifications V2 with a certificate chain
// rooted at Apple Root CA - G3 (ECDSA P-384). This module cryptographically
// verifies that chain and the JWS signature to prevent forged notifications.
//
// Reference: https://developer.apple.com/documentation/appstoreservernotifications

// SHA-256 fingerprint of Apple Root CA - G3 (ECDSA P-384)
// Source: https://www.apple.com/certificateauthority/
// Verified: 63:34:3a:bf:b8:9a:6a:03:eb:b5:7e:9b:3f:5f:a7:be:7c:4f:5c:75:6f:30:17:b3:a8:c4:88:c3:65:3e:91:79
// IMPORTANT: This must be exactly 64 hex characters (32 bytes).
const APPLE_ROOT_CA_G3_SHA256 =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

// ─── Public API ──────────────────────────────────────────────

/**
 * Verify and decode an Apple-signed JWS payload.
 * Validates the full x5c certificate chain and JWS signature.
 *
 * @param jws  The signed JWS string from Apple
 * @returns    The decoded and verified payload
 * @throws {AppleJwsError} On any verification failure
 */
export async function verifyAndDecodeAppleJws(
  jws: string,
): Promise<Record<string, unknown>> {
  const parts = jws.split('.');
  if (parts.length !== 3) {
    throw new AppleJwsError('Invalid JWS format: expected 3 parts');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Parse header and extract certificate chain
  const header = JSON.parse(b64UrlToString(headerB64));

  if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new AppleJwsError('Missing or invalid x5c certificate chain');
  }

  const alg = header.alg as string;
  if (alg !== 'ES256' && alg !== 'ES384') {
    throw new AppleJwsError(`Unsupported JWS algorithm: ${alg}`);
  }

  // 2. Decode certificates (x5c contains standard base64-encoded DER certs)
  const certChain: Uint8Array[] = header.x5c.map((b64: string) =>
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );

  // 3. Verify root certificate fingerprint (Apple Root CA - G3)
  const rootCert = certChain[certChain.length - 1];
  const rootHash = await sha256Hex(rootCert);

  if (rootHash !== APPLE_ROOT_CA_G3_SHA256) {
    throw new AppleJwsError(
      `Root certificate mismatch: expected Apple Root CA - G3, got ${rootHash}`,
    );
  }

  // 4. Verify certificate chain: each cert[i] is signed by cert[i+1]
  for (let i = 0; i < certChain.length - 1; i++) {
    await verifyCertSignedBy(certChain[i], certChain[i + 1]);
  }

  // 5. Verify JWS signature with leaf certificate's public key
  const leafSpki = extractSpki(certChain[0]);
  const leafCurve = detectCurveFromSpki(leafSpki);
  const { hash } = jwsAlgParams(alg);

  const leafKey = await crypto.subtle.importKey(
    'spki',
    leafSpki,
    { name: 'ECDSA', namedCurve: leafCurve },
    false,
    ['verify'],
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = b64UrlToBytes(signatureB64);

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: hash } },
    leafKey,
    signature,
    signingInput,
  );

  if (!valid) {
    throw new AppleJwsError('JWS signature verification failed');
  }

  // 6. Return the verified payload
  return JSON.parse(b64UrlToString(payloadB64));
}

/**
 * Decode a JWS payload WITHOUT signature verification.
 * Only safe for JWS nested inside an already-verified outer JWS
 * (e.g., signedTransactionInfo within a verified notification).
 */
export function decodeJwsPayloadUnsafe(jws: string): Record<string, unknown> {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new AppleJwsError('Invalid JWS format');
  return JSON.parse(b64UrlToString(parts[1]));
}

export class AppleJwsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleJwsError';
  }
}

// ─── Certificate Chain Verification ─────────────────────────

/**
 * Verify that `cert` was signed by `issuerCert`.
 * Extracts TBS bytes, signature algorithm, and signature from the child cert,
 * then verifies using the issuer cert's public key via Web Crypto.
 */
async function verifyCertSignedBy(
  cert: Uint8Array,
  issuerCert: Uint8Array,
): Promise<void> {
  const { tbsBytes, signatureAlgOid, signatureValue } = parseCertStructure(cert);

  // Hash algorithm comes from the cert's signature algorithm OID
  const hash = hashFromSigAlgOid(signatureAlgOid);

  // Curve comes from the issuer's actual public key
  const issuerSpki = extractSpki(issuerCert);
  const namedCurve = detectCurveFromSpki(issuerSpki);

  const issuerKey = await crypto.subtle.importKey(
    'spki',
    issuerSpki,
    { name: 'ECDSA', namedCurve },
    false,
    ['verify'],
  );

  // X.509 signatures are DER-encoded — convert to raw r||s for Web Crypto
  const componentSize = namedCurve === 'P-256' ? 32 : 48;
  const rawSig = derEcdsaToRaw(signatureValue, componentSize);

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: hash } },
    issuerKey,
    rawSig,
    tbsBytes,
  );

  if (!valid) {
    throw new AppleJwsError('Certificate chain verification failed');
  }
}

// ─── Minimal DER / ASN.1 Parser ─────────────────────────────

interface DerElement {
  tag: number;
  headerSize: number;
  contentLength: number;
  fullBytes: Uint8Array; // tag + length + content
  content: Uint8Array; // content only
}

/**
 * Parse a single DER-encoded ASN.1 element starting at `offset`.
 */
function parseDerAt(data: Uint8Array, offset: number): DerElement {
  const tag = data[offset];
  let pos = offset + 1;

  // Parse length (DER definite-length encoding)
  let contentLength: number;
  if (data[pos] < 0x80) {
    // Short form: length in a single byte
    contentLength = data[pos];
    pos++;
  } else {
    // Long form: first byte = 0x80 | numLengthBytes
    const numLenBytes = data[pos] & 0x7f;
    pos++;
    contentLength = 0;
    for (let i = 0; i < numLenBytes; i++) {
      contentLength = (contentLength << 8) | data[pos + i];
    }
    pos += numLenBytes;
  }

  const headerSize = pos - offset;

  return {
    tag,
    headerSize,
    contentLength,
    fullBytes: data.slice(offset, pos + contentLength),
    content: data.slice(pos, pos + contentLength),
  };
}

/**
 * Parse all sequential DER elements within a byte array.
 * Used to iterate children of a SEQUENCE or SET.
 */
function parseChildren(content: Uint8Array): DerElement[] {
  const children: DerElement[] = [];
  let pos = 0;

  while (pos < content.length) {
    const el = parseDerAt(content, pos);
    children.push(el);
    pos += el.headerSize + el.contentLength;
  }

  return children;
}

// ─── X.509 Certificate Structure ────────────────────────────

interface CertStructure {
  tbsBytes: Uint8Array; // Raw DER bytes of TBS (signed by issuer)
  signatureAlgOid: Uint8Array; // Signature algorithm OID value bytes
  signatureValue: Uint8Array; // Raw signature bytes (DER-encoded ECDSA)
}

/**
 * Parse a DER-encoded X.509 certificate into its three top-level components:
 *   Certificate ::= SEQUENCE {
 *     tbsCertificate       TBSCertificate,
 *     signatureAlgorithm   AlgorithmIdentifier,
 *     signatureValue       BIT STRING
 *   }
 */
function parseCertStructure(certDer: Uint8Array): CertStructure {
  const outer = parseDerAt(certDer, 0);
  if (outer.tag !== 0x30) {
    throw new AppleJwsError('Certificate is not a SEQUENCE');
  }

  const children = parseChildren(outer.content);
  if (children.length < 3) {
    throw new AppleJwsError('Certificate has fewer than 3 top-level elements');
  }

  // [0] TBS Certificate — full DER bytes (tag + length + content)
  const tbsBytes = children[0].fullBytes;

  // [1] Signature Algorithm — SEQUENCE { OID, [params] }
  const sigAlgChildren = parseChildren(children[1].content);
  const signatureAlgOid = sigAlgChildren[0].content;

  // [2] Signature Value — BIT STRING (first byte = unused bits count, always 0)
  const signatureValue = children[2].content.slice(1);

  return { tbsBytes, signatureAlgOid, signatureValue };
}

/**
 * Extract the SubjectPublicKeyInfo (SPKI) DER bytes from an X.509 certificate.
 * This is the format accepted by Web Crypto's importKey('spki', ...).
 *
 *   TBSCertificate ::= SEQUENCE {
 *     version         [0] EXPLICIT INTEGER OPTIONAL,
 *     serialNumber    INTEGER,
 *     signature       AlgorithmIdentifier,
 *     issuer          Name,
 *     validity        Validity,
 *     subject         Name,
 *     subjectPublicKeyInfo  SubjectPublicKeyInfo,  <-- this one
 *     ...
 *   }
 */
function extractSpki(certDer: Uint8Array): Uint8Array {
  const outer = parseDerAt(certDer, 0);
  const certChildren = parseChildren(outer.content);
  const tbsChildren = parseChildren(certChildren[0].content);

  // Skip context-specific [0] EXPLICIT version tag if present
  let idx = 0;
  if ((tbsChildren[0].tag & 0xe0) === 0xa0) {
    idx++;
  }

  // Skip: serialNumber, signature, issuer, validity, subject (5 fields)
  idx += 5;

  if (idx >= tbsChildren.length) {
    throw new AppleJwsError('TBS too short to contain SPKI');
  }

  return tbsChildren[idx].fullBytes;
}

// ─── Algorithm Detection ────────────────────────────────────

// ECDSA signature algorithm OIDs
const OID_ECDSA_SHA256 = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]);
const OID_ECDSA_SHA384 = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x03]);

// Named curve OIDs (from SPKI AlgorithmIdentifier)
const OID_P256 = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
const OID_P384 = new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x22]);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Determine the hash algorithm from an X.509 signature algorithm OID.
 */
function hashFromSigAlgOid(oid: Uint8Array): string {
  if (bytesEqual(oid, OID_ECDSA_SHA256)) return 'SHA-256';
  if (bytesEqual(oid, OID_ECDSA_SHA384)) return 'SHA-384';
  throw new AppleJwsError('Unsupported certificate signature algorithm');
}

/**
 * Detect the named curve from an SPKI's AlgorithmIdentifier.
 *   SubjectPublicKeyInfo ::= SEQUENCE {
 *     algorithm SEQUENCE { OID ecPublicKey, OID namedCurve }
 *     subjectPublicKey BIT STRING
 *   }
 */
function detectCurveFromSpki(spki: Uint8Array): string {
  const spkiEl = parseDerAt(spki, 0);
  const children = parseChildren(spkiEl.content);

  // First child = AlgorithmIdentifier SEQUENCE
  const algChildren = parseChildren(children[0].content);

  // Second element in AlgorithmIdentifier is the curve OID
  if (algChildren.length >= 2 && algChildren[1].tag === 0x06) {
    if (bytesEqual(algChildren[1].content, OID_P256)) return 'P-256';
    if (bytesEqual(algChildren[1].content, OID_P384)) return 'P-384';
  }

  throw new AppleJwsError('Unsupported or unrecognized curve in SPKI');
}

/**
 * Map a JWS algorithm (ES256/ES384) to its hash function.
 */
function jwsAlgParams(alg: string): { hash: string } {
  switch (alg) {
    case 'ES256':
      return { hash: 'SHA-256' };
    case 'ES384':
      return { hash: 'SHA-384' };
    default:
      throw new AppleJwsError(`Unsupported JWS algorithm: ${alg}`);
  }
}

// ─── DER ECDSA Signature Conversion ─────────────────────────

/**
 * Convert a DER-encoded ECDSA signature to raw r||s format.
 * X.509 uses DER:  SEQUENCE { INTEGER r, INTEGER s }
 * Web Crypto uses: r (fixed bytes) || s (fixed bytes)
 */
function derEcdsaToRaw(der: Uint8Array, componentSize: number): Uint8Array {
  if (der[0] !== 0x30) {
    // Might already be raw format
    if (der.length === componentSize * 2) return der;
    throw new AppleJwsError('Invalid ECDSA signature: not DER SEQUENCE');
  }

  const seq = parseDerAt(der, 0);
  const integers = parseChildren(seq.content);

  if (integers.length !== 2 || integers[0].tag !== 0x02 || integers[1].tag !== 0x02) {
    throw new AppleJwsError('Invalid ECDSA signature: expected two INTEGERs');
  }

  const r = normalizeInteger(integers[0].content, componentSize);
  const s = normalizeInteger(integers[1].content, componentSize);

  const raw = new Uint8Array(componentSize * 2);
  raw.set(r, 0);
  raw.set(s, componentSize);
  return raw;
}

/**
 * Normalize a DER INTEGER to a fixed-size unsigned big-endian byte array.
 * DER integers may have a leading 0x00 to indicate positive sign,
 * or may be shorter than the target size.
 */
function normalizeInteger(bytes: Uint8Array, targetSize: number): Uint8Array {
  // Strip leading zero bytes (DER sign padding)
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start++;
  }

  const trimmed = bytes.slice(start);

  if (trimmed.length === targetSize) return trimmed;

  if (trimmed.length > targetSize) {
    return trimmed.slice(trimmed.length - targetSize);
  }

  // Pad with leading zeros
  const padded = new Uint8Array(targetSize);
  padded.set(trimmed, targetSize - trimmed.length);
  return padded;
}

// ─── Base64 / Hashing Utilities ─────────────────────────────

function b64UrlToString(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64);
}

function b64UrlToBytes(b64url: string): Uint8Array {
  const decoded = b64UrlToString(b64url);
  return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}