import fs from "fs";
import crypto from "crypto";
import "dotenv/config";

const privateKeyPem = process.env.PLUGIN_PRIVATE_KEY;

if (!privateKeyPem) {
  throw new Error("PLUGIN_PRIVATE_KEY not set");
}

const privateKey = crypto.createPrivateKey(privateKeyPem);

const publicKeyObj = crypto.createPublicKey(privateKey);

const publicKey = publicKeyObj.export({
  type: "spki",
  format: "pem",
});

fs.writeFileSync("public.key", publicKey);

console.log("public key generated");
