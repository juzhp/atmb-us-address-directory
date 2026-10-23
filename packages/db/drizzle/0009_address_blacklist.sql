CREATE TABLE IF NOT EXISTS `address_blacklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`street_address` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`postal_code` text NOT NULL,
	`normalized_address_key` text NOT NULL,
	`reason` text NOT NULL,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_by` text NOT NULL,
	`submitter_ip_hash` text,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "address_blacklist_status_check" CHECK("address_blacklist"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "address_blacklist_submitted_by_check" CHECK("address_blacklist"."submitted_by" IN ('visitor', 'admin'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `address_blacklist_status_idx` ON `address_blacklist` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `address_blacklist_normalized_key_idx` ON `address_blacklist` (`normalized_address_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `address_blacklist_ip_created_idx` ON `address_blacklist` (`submitter_ip_hash`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `address_blacklist_updated_at_idx` ON `address_blacklist` (`updated_at`);
