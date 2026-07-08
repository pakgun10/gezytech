CREATE TABLE `agent_skills` (
	`skill_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_skills_agent` ON `agent_skills` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_skills_skill` ON `agent_skills` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`tags` text,
	`content` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_unique` ON `skills` (`name`);--> statement-breakpoint
CREATE INDEX `idx_skills_name` ON `skills` (`name`);--> statement-breakpoint
CREATE INDEX `idx_skills_category` ON `skills` (`category`);