CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_reactions_unique` ON `message_reactions` (`message_id`,`user_id`,`emoji`);--> statement-breakpoint
CREATE INDEX `idx_message_reactions_message` ON `message_reactions` (`message_id`);