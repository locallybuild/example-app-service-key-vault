import { createHash } from "node:crypto";
import { ManagedIdentityCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { required } from "./web";

// ---------------------------------------------------------------------------
// The same Key Vault secret, reached two ways. Neither way ever puts the value
// on the page: each is shown as its length and a SHA-256 fingerprint, which is
// enough to tell whether two reads returned the same value, and whether it
// changed, without disclosing it.
// ---------------------------------------------------------------------------
export interface Fingerprint {
  length: number;
  sha256: string;
}

export function fingerprint(value: string): Fingerprint {
  return {
    length: value.length,
    // The first 16 hex characters (64 bits) are plenty to tell values apart.
    sha256: createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16),
  };
}

// ---------------------------------------------------------------------------
// Path 1 - a Key Vault reference.
//
// The DEMO_SECRET app setting holds "@Microsoft.KeyVault(SecretUri=...)". App
// Service resolves it before starting the container, so by the time the app
// runs the environment variable holds the secret's value. If App Service
// couldn't resolve it (say, the identity can't read the secret), the
// environment variable holds the reference itself, unchanged.
// ---------------------------------------------------------------------------
const REFERENCE_PREFIX = "@Microsoft.KeyVault(";

export type ReferenceResult =
  | { resolved: true; fingerprint: Fingerprint }
  | { resolved: false; reference: string };

export function readReference(): ReferenceResult {
  const value = required("DEMO_SECRET");
  if (value.startsWith(REFERENCE_PREFIX)) {
    // The unresolved reference is only a URI, not the secret, so it's safe to show.
    return { resolved: false, reference: value };
  }
  return { resolved: true, fingerprint: fingerprint(value) };
}

// ---------------------------------------------------------------------------
// Path 2 - reading the secret directly, on every request.
//
// ManagedIdentityCredential calls the App Service managed identity endpoint
// (IDENTITY_ENDPOINT / IDENTITY_HEADER) for a Key Vault token. The clientId
// selects the user-assigned identity, as a web app can have several attached.
// DefaultAzureCredential would end up in the same place, after trying (and
// skipping) the credentials meant for other environments.
// ---------------------------------------------------------------------------
export interface DirectResult {
  fingerprint: Fingerprint;
  version: string;
  updatedOn: string;
}

const credential = new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID });
const client = new SecretClient(required("KEY_VAULT_URL"), credential);

export async function readDirect(): Promise<DirectResult> {
  const secret = await client.getSecret(required("SECRET_NAME"), {
    // Bound the read, so the page reports an unreachable vault rather than
    // hanging while the client retries.
    abortSignal: AbortSignal.timeout(10_000),
  });
  return {
    fingerprint: fingerprint(secret.value ?? ""),
    version: secret.properties.version ?? "",
    updatedOn: secret.properties.updatedOn?.toISOString() ?? "",
  };
}
