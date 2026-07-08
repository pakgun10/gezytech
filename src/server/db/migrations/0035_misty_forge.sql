PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quick_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	`expires_at` integer,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_quick_sessions`("id", "kin_id", "created_by", "title", "status", "created_at", "closed_at", "expires_at") SELECT "id", "kin_id", "created_by", "title", "status", "created_at", "closed_at", "expires_at" FROM `quick_sessions`;--> statement-breakpoint
DROP TABLE `quick_sessions`;--> statement-breakpoint
ALTER TABLE `__new_quick_sessions` RENAME TO `quick_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_quick_sessions_kin_status` ON `quick_sessions` (`kin_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quick_sessions_user` ON `quick_sessions` (`created_by`);