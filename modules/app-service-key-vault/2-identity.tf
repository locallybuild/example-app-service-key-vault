# ---------------------------------------------------------------------------
# User-Assigned Managed Identity - the identity the web app reads secrets as.
#
# It's used twice: by the App Service platform, to resolve the Key Vault
# reference in the app settings (key_vault_reference_identity_id), and by the
# app itself, to read the secret directly at request time.
#
# A user-assigned (rather than system-assigned) identity exists before the web
# app does, so its role assignment is granted up front. That matters here: the
# platform resolves Key Vault references when the app starts, so the identity
# must already be able to read the secret by then.
# ---------------------------------------------------------------------------
resource "azurerm_user_assigned_identity" "app" {
  name                = "${var.name_prefix}-app-id"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags
}
