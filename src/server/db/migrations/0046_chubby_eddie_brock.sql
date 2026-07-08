ALTER TABLE `memories` ADD `scope` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_memories_scope` ON `memories` (`scope`);--> statement-breakpoint
CREATE INDEX `idx_memories_scope_category` ON `memories` (`scope`,`category`);