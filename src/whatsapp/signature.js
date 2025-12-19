const crypto = require("crypto");

function verifyMetaSignature({ appSecret, rawBody, headerSig256 }) {
  // header format: "sha256=...."
  if (!headerSig256 || typeof headerSig256 !== "string") return false;
  const parts = headerSig256.split("=");
  if (parts.length !== 2) return false;
  const algo = parts[0];
  const theirSig = parts[1];
  if (algo !== "sha256") return false;

  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const ourSig = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(theirSig, "hex"), Buffer.from(ourSig, "hex"));
  } catch {
    return false;
  }
}

module.exports = { verifyMetaSignature };
