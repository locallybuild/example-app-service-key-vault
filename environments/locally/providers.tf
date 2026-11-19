terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

provider "azurerm" {
  features {}
}

module "app-service-key-vault" {
  source = "../../modules/app-service-key-vault"

  name_prefix = "locally-example-keyvault"
  location    = "berlin"
  tags = {
    ProvisionedVia = "Terraform"
  }
}
