-- Add stable human-readable slug to providers (used by Kins in tool calls
-- like spawn_self/spawn_kin where the UUID is unwieldy).
--
-- Backfill strategy: copy the id into slug for every existing row so the
-- UNIQUE constraint is satisfied immediately. The startup-time service
-- `backfill-provider-slugs` then rewrites those id-shaped slugs into
-- proper kebab-case slugs derived from the provider's name, with
-- collision handling. After backfill, every insertion goes through the
-- TypeScript code which always provides a real slug.
ALTER TABLE providers ADD COLUMN slug TEXT;
--> statement-breakpoint
UPDATE providers SET slug = id WHERE slug IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX providers_slug_unique ON providers(slug);
