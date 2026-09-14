const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(scryptCallback);
const PASSWORD_SCRYPT_KEYLEN = 64;

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, PASSWORD_SCRYPT_KEYLEN);
  return `scrypt$${salt}$${Buffer.from(key).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }

  if (!storedHash.startsWith("scrypt$")) {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [, salt, keyHex] = parts;
  const expectedBuffer = Buffer.from(keyHex, "hex");
  const calculated = await scrypt(password, salt, PASSWORD_SCRYPT_KEYLEN);
  const calculatedBuffer = Buffer.from(calculated);

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, calculatedBuffer);
}

function hashSessionToken(sessionToken) {
  return createHash("sha256").update(String(sessionToken || "")).digest("hex");
}

module.exports = {
  createPasswordHash,
  verifyPassword,
  hashSessionToken,
};
