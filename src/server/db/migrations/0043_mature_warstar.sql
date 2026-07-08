ALTER TABLE `messages` ADD `channel_origin_id` text;--> statement-breakpoint
ALTER TABLE `queue_items` ADD `channel_origin_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `channel_origin_id` text;