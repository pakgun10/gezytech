CREATE TABLE `cron_learnings` (
	`id` text PRIMARY KEY NOT NULL,
	`cron_id` text NOT NULL,
	`content` text NOT NULL,
	`category` text,
	`task_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cron_id`) REFERENCES `crons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_cron_learnings_cron` ON `cron_learnings` (`cron_id`);