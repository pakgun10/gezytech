PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`args` text,
	`env` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_kin_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_mcp_servers` SELECT `id`, `name`, `command`, `args`, `env`, `status`, `created_by_kin_id`, `created_at`, `updated_at` FROM `mcp_servers`;
--> statement-breakpoint
DROP TABLE `mcp_servers`;
--> statement-breakpoint
ALTER TABLE `__new_mcp_servers` RENAME TO `mcp_servers`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
