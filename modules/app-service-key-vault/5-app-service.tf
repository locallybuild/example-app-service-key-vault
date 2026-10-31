# ---------------------------------------------------------------------------
# App Service Plan - houses the App Service.
# ---------------------------------------------------------------------------
resource "azurerm_service_plan" "main" {
  name                = "${var.name_prefix}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
}

# ---------------------------------------------------------------------------
# The web app - shows the same Key Vault secret reached two ways:
#
#   1. DEMO_SECRET is a Key Vault reference. App Service resolves it, as the
#      identity in key_vault_reference_identity_id, before the container
#      starts, and the app sees the secret's value as an ordinary environment
#      variable. The reference is versionless, so it follows the latest version
#      of the secret - but only when the app restarts.
#
#   2. The app also reads the secret itself on every page load, with the Key
#      Vault SDK and the same identity, so a new version shows up immediately.
#
# Neither way puts the secret in Terraform's app_settings: the setting holds
# only the reference.
# ---------------------------------------------------------------------------
resource "azurerm_linux_web_app" "main" {
  name                = "${var.name_prefix}-app"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_service_plan.main.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  tags                = var.tags

  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  # Without this, App Service resolves Key Vault references as the web app's
  # system-assigned identity - which it doesn't have.
  key_vault_reference_identity_id = azurerm_user_assigned_identity.app.id

  site_config {
    health_check_path                 = "/healthz"
    health_check_eviction_time_in_min = 2

    application_stack {
      docker_image_name        = "${local.image_name}:${local.image_tag}"
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }
  }

  app_settings = {
    # App Service routes public traffic to the container on this port, and the
    # app binds to it (12-factor port binding).
    WEBSITES_PORT = tostring(local.app_port)
    PORT          = tostring(local.app_port)

    # Path 1 - a Key Vault reference. The versionless URI means "the latest
    # version", resolved whenever the app (re)starts.
    DEMO_SECRET = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.demo.versionless_id})"

    # Path 2 - where the app reads the secret from itself.
    KEY_VAULT_URL = azurerm_key_vault.main.vault_uri
    SECRET_NAME   = azurerm_key_vault_secret.demo.name

    # Selects which of the web app's identities DefaultAzureCredential uses.
    AZURE_CLIENT_ID = azurerm_user_assigned_identity.app.client_id
  }

  # The image must exist in the registry, and the identity must be able to read
  # the secret, before the app starts.
  depends_on = [
    terraform_data.build_and_push,
    azurerm_role_assignment.app_secrets_user,
  ]
}
