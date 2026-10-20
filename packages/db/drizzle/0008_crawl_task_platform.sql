ALTER TABLE `crawl_tasks` ADD COLUMN `platform` text DEFAULT 'anytimemailbox' NOT NULL;
--> statement-breakpoint
CREATE INDEX `addresses_source_idx` ON `addresses` (`source`);
