import express, { Request, Response } from "express";
import { DirectResult, readDirect, readReference } from "./secrets";
import { errorHandler, escapeHtml, handle, renderList, renderPage, required } from "./web";

const PORT = Number(process.env.PORT ?? 8080);

const app = express();

app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).send("ok");
});

app.get("/", handle(async (_req, res) => {
  const secretName = required("SECRET_NAME");
  const vaultUrl = required("KEY_VAULT_URL");

  const reference = readReference();
  const direct: DirectResult | Error = await readDirect().catch((err: Error) => err);

  const referenceSection = reference.resolved
    ? `<p class="notice">App Service resolved the reference before the app started.</p>
       ${renderList([
         ["Length", String(reference.fingerprint.length)],
         ["SHA-256 (first 16 hex)", reference.fingerprint.sha256],
       ])}`
    : `<p class="error">App Service did not resolve the reference - the environment variable still holds it:<br><code>${escapeHtml(reference.reference)}</code></p>`;

  const directSection =
    direct instanceof Error
      ? `<p class="error">Couldn't read the secret: ${escapeHtml(direct.message)}</p>`
      : renderList([
          ["Length", String(direct.fingerprint.length)],
          ["SHA-256 (first 16 hex)", direct.fingerprint.sha256],
          ["Version", direct.version],
          ["Updated", direct.updatedOn],
        ]);

  let comparison = "";
  if (reference.resolved && !(direct instanceof Error)) {
    comparison =
      reference.fingerprint.sha256 === direct.fingerprint.sha256
        ? `<p class="notice">Both paths see the same value.</p>`
        : `<p class="warning">The paths differ: the secret has a newer version than the one App Service resolved when the app started. Restart the app to pick it up through the reference.</p>`;
  }

  const body = `
    <h1>Key Vault secrets in App Service</h1>
    <p class="flow">The secret <code>${escapeHtml(secretName)}</code> in <code>${escapeHtml(vaultUrl)}</code>, read as the web app's user-assigned managed identity, two ways. Each is shown as its length and a SHA-256 fingerprint, never the value itself.</p>
    ${comparison}
    <section>
      <h2>1. Key Vault reference (resolved by App Service at start-up)</h2>
      <p class="flow">App setting <code>DEMO_SECRET = @Microsoft.KeyVault(SecretUri=...)</code> &rarr; App Service &rarr; Key Vault &rarr; environment variable</p>
      ${referenceSection}
    </section>
    <section>
      <h2>2. Read directly by the app (on every page load)</h2>
      <p class="flow">App &rarr; managed identity endpoint &rarr; Entra token &rarr; Key Vault <code>GET /secrets/${escapeHtml(secretName)}</code></p>
      ${directSection}
    </section>`;
  res.send(renderPage("Key Vault secrets", body));
}));

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`listening on 0.0.0.0:${PORT}, reading secret ${process.env.SECRET_NAME} from ${process.env.KEY_VAULT_URL}`);
});
