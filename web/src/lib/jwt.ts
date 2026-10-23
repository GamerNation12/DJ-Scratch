import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const DEV_FALLBACK = 'fallback_secret_for_development';

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (secret) return new TextEncoder().encode(secret);

  // A known fallback in production would let anyone mint an owner token.
  // Fail closed instead: verifyToken() returns null and signToken() errors
  // until the deployment sets NEXTAUTH_SECRET.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  return new TextEncoder().encode(DEV_FALLBACK);
}

export async function signToken(payload: JWTPayload) {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(getJwtSecret());
  return jwt;
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}
