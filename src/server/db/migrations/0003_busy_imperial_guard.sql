ALTER TABLE `vault_secrets` ADD `description` text;--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD `created_by_kin_id` text REFERENCES kins(id);