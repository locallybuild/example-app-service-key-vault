```
ooooo                                      oooo  oooo              
`888'                                      `888  `888              
 888          .ooooo.   .ooooo.   .oooo.    888   888  oooo    ooo 
 888         d88' `88b d88' `"Y8 `P  )88b   888   888   `88.  .8'
 888         888   888 888        .oP"888   888   888    `88..8'
 888       o 888   888 888   .o8 d8(  888   888   888     `888'
o888ooooood8 `Y8bod8P' `Y8bod8P' `Y888""8o o888o o888o     .8'
                                                       .o..P'
                                                       `Y8P'
```

# Example: Read Key Vault secrets from App Service within Locally

This example shows how to read a secret from Azure Key Vault in an app on App Service, in the two ways App Service apps usually do it, on [Locally Build](https://locally.build). Both use the web app's **user-assigned managed identity**, so no key, password or connection string is stored anywhere in the app or its settings.

```
                        ┌─ 1. Key Vault reference (resolved by App Service when the app starts)
                        │     app setting DEMO_SECRET = @Microsoft.KeyVault(SecretUri=...)
                        │     App Service ─▶ Key Vault ─▶ $DEMO_SECRET in the container
 web app (App Service) ─┤
                        │
                        └─ 2. Direct read (by the app, on every page load)
                              GET $IDENTITY_ENDPOINT ─▶ Entra token (aud: vault.azure.net)
                              @azure/keyvault-secrets ─▶ Key Vault GET /secrets/demo-secret
```

The app is written in TypeScript (Node.js and Express). The source lives in [`app/`](./app), alongside the infrastructure that runs it. Its one page shows the secret as read each way. It never shows the value itself, only its length and a SHA-256 fingerprint, which is enough to tell whether the two reads match and whether the value has changed.

### 1. Key Vault references

An app setting whose value is `@Microsoft.KeyVault(SecretUri=...)` is a [Key Vault reference](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references). App Service fetches the secret before it starts the container, and the app sees the secret's value as an ordinary environment variable. The app needs no Key Vault code at all.

By default App Service fetches the secret as the web app's system-assigned identity. This web app only has a user-assigned identity, so `key_vault_reference_identity_id` tells App Service to use that instead.

If App Service can't resolve a reference (for example, the identity isn't allowed to read the secret), it doesn't fail the app: the environment variable holds the reference text unchanged. The page checks for this and says so.

### 2. Reading the secret directly

[`app/src/secrets.ts`](./app/src/secrets.ts) also reads the same secret on every page load with `SecretClient` from `@azure/keyvault-secrets`. Its credential is `ManagedIdentityCredential` from `@azure/identity`, which asks the App Service managed identity endpoint (`IDENTITY_ENDPOINT`) for a Key Vault token for the identity named by `AZURE_CLIENT_ID`. Reading directly also gives the app the secret's metadata, so the page shows the version it read and when that version was created.

### When each path sees a new version

The reference has no version in its URI, so it always means "the latest version", but App Service only resolves it when the app starts. The direct read happens on every request. So after you rotate the secret:

* **path 2 (direct read)** shows the new version on the next page load.
* **path 1 (reference)** keeps the old value until the app restarts. On Azure, App Service also re-fetches versionless references every 24 hours, and whenever the app's configuration changes, both of which restart the app.

Until the app restarts, the page shows that the two paths differ.

### Least privilege

The vault uses Azure RBAC for access to its data (`rbac_authorization_enabled = true`) rather than access policies. With RBAC, nobody can read or write a secret until they hold a role on the vault, including whoever created it. So there are two role assignments:

| Principal | Role | Scope |
| --- | --- | --- |
| whoever runs Terraform | Key Vault Secrets Officer | the vault, so Terraform can write the secret |
| the web app's identity | Key Vault Secrets User | the `demo-secret` secret only |

The secret's value comes from a `random_password` resource, so nobody types it in. It is stored in the vault and in the Terraform state.

## Requirements

* [Locally Build](https://locally.build).
* Either [HashiCorp Terraform](https://terraform.io) or [OpenTofu](https://opentofu.org).
* Either [Docker](https://www.docker.com) or [Podman](https://podman.io) (recommended).
* The Locally Plugin for `Microsoft.KeyVault` installed (`locally plugin install --name Microsoft.KeyVault`).
* The Locally Plugin for `Microsoft.Web` installed (`locally plugin install --name Microsoft.Web`).
* The Locally Plugin for `Microsoft.ContainerRegistry` installed (`locally plugin install --name Microsoft.ContainerRegistry`).
* The Locally Plugin for `Microsoft.Insights` installed (`locally plugin install --name Microsoft.Insights`).
* The Locally Plugin for `Microsoft.OperationalInsights` installed (`locally plugin install --name Microsoft.OperationalInsights`).

## Running the example

First up, we need to ensure our container runtime (Docker or Podman) is running, then launch Locally:

```bash
locally build
```

With Locally running, in another terminal we can initialise Terraform, which both downloads the providers we need and configures the module for use:

```bash
cd environments/locally
terraform init
```

> [!NOTE]
> It's possible to use OpenTofu here by substituting `terraform` for `tofu`.

With Terraform initialised, we can then provision the example by running:

```bash
locally run terraform apply
```

As part of the apply, the app is built with `docker build` and pushed into the Container Registry, so the `docker` command needs to be available (with Podman, the `podman-docker` shim or a `docker` alias works).

Once you approve the plan and the resources have been deployed, the application is running at the URL in the outputs:

```
https://locally-example-keyvault-app.furnace.locally:5663
```

[Open that URL in a browser](https://locally-example-keyvault-app.furnace.locally:5663) and both sections show the same length and fingerprint, and the page says that both paths see the same value.

---

As this Terraform configuration sends the App Service logs into a Log Analytics Workspace, we can then query them within [the Locally Dashboard, in the Monitoring section](https://localhost:5678/monitoring/components), by running:

```
AppServiceConsoleLogs | order by TimeGenerated desc
```

## Rotating the secret

Write a new version of the secret, either with the Azure CLI:

```bash
locally run az keyvault secret set --vault-name locallyexamplekeyvaultkv --name demo-secret --value "$(openssl rand -hex 16)"
```

or by having Terraform generate a new value:

```bash
locally run terraform apply -replace=module.app-service-key-vault.random_password.demo
```

Reload the page. Path 2 shows the new fingerprint, version and time straight away, while path 1 still shows the old one. Restart the app and reload again, and path 1 has caught up:

```bash
locally run az webapp restart --resource-group locally-example-keyvault-resources --name locally-example-keyvault-app
```

(If you rotated with the Azure CLI, the next `terraform apply` writes Terraform's value back as yet another version, because the secret no longer matches its configuration.)

You can list the secret's versions from the CLI:

```bash
locally run az keyvault secret list-versions --vault-name locallyexamplekeyvaultkv --name demo-secret -o table
```

## Notes

> [!WARNING]
> Locally doesn't resolve Key Vault references yet. It accepts and stores the reference, and reports it through the `config/configreferences/appsettings` API, but the container's `DEMO_SECRET` holds the reference text, so path 1 shows "App Service did not resolve the reference". On Azure, the same configuration resolves. Path 2, and everything else in this example, works the same on Locally as on Azure.

This example has no sign-in of its own, so anyone who can reach the app can see the fingerprints. They don't reveal the secret, but a real app would sit behind authentication anyway.

Key Vault names are global on Azure, so if you deploy this to Azure, change `name_prefix` to something unique. A deleted vault is kept (soft-deleted) for `soft_delete_retention_days` before its name can be reused. Terraform's azurerm provider purges it on destroy by default.

## Tearing it down

```bash
cd environments/locally
locally run terraform destroy
```
