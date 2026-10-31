output "app_url" {
  description = "Where to reach the app in a browser."
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "resource_group" {
  description = "The resource group containing the deployed resources."
  value       = azurerm_resource_group.main.name
}

output "web_app_name" {
  description = "The name of the web app (to restart it after rotating the secret)."
  value       = azurerm_linux_web_app.main.name
}

output "key_vault_name" {
  description = "The Key Vault holding the secret."
  value       = azurerm_key_vault.main.name
}

output "secret_name" {
  description = "The name of the secret the app reads."
  value       = azurerm_key_vault_secret.demo.name
}
