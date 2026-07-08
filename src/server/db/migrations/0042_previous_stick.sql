ALTER TABLE `tasks` ADD `inter_kin_request_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `pending_request_id` text;