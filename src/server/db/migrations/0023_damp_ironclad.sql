CREATE TABLE `vault_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`original_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `vault_secrets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vault_attachments_entry` ON `vault_attachments` (`entry_id`);--> statement-breakpoint
CREATE TABLE `vault_types` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`fields` text NOT NULL,
	`is_built_in` integer DEFAULT false NOT NULL,
	`created_by_kin_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vault_types_slug_unique` ON `vault_types` (`slug`);--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD `entry_type` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD `vault_type_id` text REFERENCES vault_types(id);--> statement-breakpoint
ALTER TABLE `vault_secrets` ADD `is_favorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_vault_secrets_entry_type` ON `vault_secrets` (`entry_type`);