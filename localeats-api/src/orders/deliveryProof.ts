import { createHmac } from "node:crypto";
import { OrderContractError } from "./orderContract.js";

export interface DeliveryProof {
  pin: string;
  qr_token: string;
  pin_hash: string;
  qr_hash: string;
}

const requireSecret = (secret: string | undefined): string => {
  if (!secret || secret.length < 32) {
    throw new OrderContractError(
      503,
      "DELIVERY_CONFIRMATION_NOT_CONFIGURED",
      "Delivery confirmation is not configured. No delivery order was placed.",
    );
  }
  return secret;
};
export const hashDeliveryProof = (proof: string, secret: string | undefined): string =>
  createHmac("sha256", requireSecret(secret)).update(proof, "utf8").digest("hex");

export const deriveDeliveryProof = (
  idempotencyKey: string,
  secret: string | undefined,
): DeliveryProof => {
  const normalizedSecret = requireSecret(secret);
  const seed = createHmac("sha256", normalizedSecret)
    .update(`localeats-delivery:${idempotencyKey}`, "utf8")
    .digest();
  const pin = (seed.readUInt32BE(0) % 10_000).toString().padStart(4, "0");
  const qrToken = `le_${seed.toString("hex")}`;
  return {
    pin,
    qr_token: qrToken,
    pin_hash: hashDeliveryProof(pin, normalizedSecret),
    qr_hash: hashDeliveryProof(qrToken, normalizedSecret),
  };
};
