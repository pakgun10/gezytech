PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contact_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contact_identifiers`("id", "contact_id", "label", "value", "created_at", "updated_at") SELECT "id", "contact_id", COALESCE("label", "type", 'other'), "value", "created_at", "updated_at" FROM `contact_identifiers`;--> statement-breakpoint
DROP TABLE `contact_identifiers`;--> statement-breakpoint
ALTER TABLE `__new_contact_identifiers` RENAME TO `contact_identifiers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_contact_identifiers_contact_id` ON `contact_identifiers` (`contact_id`);