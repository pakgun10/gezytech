CREATE TABLE `scheduled_wakeups` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_kin_id` text NOT NULL,
	`target_kin_id` text NOT NULL,
	`reason` text,
	`fire_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`caller_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wakeups_target_status` ON `scheduled_wakeups` (`target_kin_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_wakeups_caller` ON `scheduled_wakeups` (`caller_kin_id`);
