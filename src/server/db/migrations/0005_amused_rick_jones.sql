CREATE TABLE `contact_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_contact_identifiers_contact_id` ON `contact_identifiers` (`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_identifiers_contact_type` ON `contact_identifiers` (`contact_id`,`type`);--> statement-breakpoint
CREATE TABLE `contact_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`kin_id` text NOT NULL,
	`scope` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contact_notes_unique` ON `contact_notes` (`contact_id`,`kin_id`,`scope`);--> statement-breakpoint
CREATE INDEX `idx_contact_notes_contact_id` ON `contact_notes` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_contact_notes_kin_id` ON `contact_notes` (`kin_id`);--> statement-breakpoint
CREATE TABLE `__new_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`linked_user_id` text,
	`linked_kin_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`linked_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_kin_id`) REFERENCES `kins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_contacts`("id", "name", "type", "linked_user_id", "linked_kin_id", "created_at", "updated_at") SELECT "id", "name", "type", "linked_user_id", "linked_kin_id", "created_at", "updated_at" FROM `contacts`;--> statement-breakpoint
DROP TABLE `contacts`;--> statement-breakpoint
ALTER TABLE `__new_contacts` RENAME TO `contacts`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_contacts_kin_id`;
