CREATE TABLE IF NOT EXISTS `address_blacklist_marks` (
	`address_id` integer PRIMARY KEY NOT NULL REFERENCES `addresses`(`id`) ON DELETE CASCADE,
	`blacklist_id` integer NOT NULL REFERENCES `address_blacklist`(`id`) ON DELETE CASCADE,
	`marked_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `address_blacklist_marks_blacklist_idx` ON `address_blacklist_marks` (`blacklist_id`);
