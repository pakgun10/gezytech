CREATE TABLE `human_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`kin_id` text NOT NULL,
	`task_id` text,
	`message_id` text,
	`prompt_type` text NOT NULL,
	`question` text NOT NULL,
	`description` text,
	`options` text NOT NULL,
	`response` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_human_prompts_kin` ON `human_prompts` (`kin_id`);--> statement-breakpoint
CREATE INDEX `idx_human_prompts_task` ON `human_prompts` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_human_prompts_status` ON `human_prompts` (`status`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `allow_human_prompt` integer DEFAULT true NOT NULL;