ALTER TABLE `webhook_logs` ADD `filtered` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `filter_mode` text;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `filter_field` text;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `filter_allowed_values` text;--> statement-breakpoint
ALTER TABLE `webhooks` ADD `filter_expression` text;