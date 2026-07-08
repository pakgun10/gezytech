CREATE TABLE `kin_read_state` (
	`user_id` text NOT NULL,
	`kin_id` text NOT NULL,
	`last_read_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kin_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kin_read_state_user` ON `kin_read_state` (`user_id`);