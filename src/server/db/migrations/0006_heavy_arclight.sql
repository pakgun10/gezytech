DROP INDEX `idx_contact_identifiers_contact_type`;--> statement-breakpoint
ALTER TABLE `contact_identifiers` ADD `label` text;--> statement-breakpoint
ALTER TABLE `mcp_servers` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `mcp_servers` ADD `created_by_kin_id` text REFERENCES kins(id);