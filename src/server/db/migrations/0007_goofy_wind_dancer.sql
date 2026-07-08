CREATE TABLE `file_storage` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`original_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`access_token` text NOT NULL,
	`password_hash` text,
	`is_public` integer DEFAULT true NOT NULL,
	`read_and_burn` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`download_count` integer DEFAULT 0 NOT NULL,
	`created_by_kin_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_storage_access_token_unique` ON `file_storage` (`access_token`);--> statement-breakpoint
CREATE INDEX `idx_file_storage_token` ON `file_storage` (`access_token`);--> statement-breakpoint
CREATE INDEX `idx_file_storage_kin` ON `file_storage` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_file_storage_expires` ON `file_storage` (`expires_at`);