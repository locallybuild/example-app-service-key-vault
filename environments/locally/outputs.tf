output "app_url" {
  description = "Where to reach the app in a browser."
  value       = module.app-service-key-vault.app_url
}

output "resource_group" {
  description = "The resource group containing the deployed resources."
  value       = module.app-service-key-vault.resource_group
}

output "web_app_name" {
  description = "The name of the web app (to restart it after rotating the secret)."
  value       = module.app-service-key-vault.web_app_name
}

output "key_vault_name" {
  description = "The Key Vault holding the secret."
  value       = module.app-service-key-vault.key_vault_name
}

output "secret_name" {
  description = "The name of the secret the app reads."
  value       = module.app-service-key-vault.secret_name
}
