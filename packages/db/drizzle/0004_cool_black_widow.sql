CREATE TABLE `crawl_discovered_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`source` text DEFAULT 'anytimemailbox' NOT NULL,
	`source_id` text,
	`state_name` text NOT NULL,
	`state` text NOT NULL,
	`state_url` text NOT NULL,
	`state_location_count` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`anytime_url` text NOT NULL,
	`signup_url` text,
	`myear_url` text,
	`country` text DEFAULT 'United States' NOT NULL,
	`city` text NOT NULL,
	`street_address` text NOT NULL,
	`postal_code` text NOT NULL,
	`full_address` text NOT NULL,
	`normalized_address_key` text NOT NULL,
	`price_cents` integer NOT NULL,
	`price_currency` text DEFAULT 'USD' NOT NULL,
	`price_period` text DEFAULT 'month' NOT NULL,
	`mailbox_min` integer,
	`mailbox_max` integer,
	`mailbox_count` integer,
	`mailbox_numbers_json` text,
	`rdi` text,
	`cmra` text,
	`smarty_raw` text,
	`smarty_checked_at` text,
	`smarty_error` text,
	`smarty_source_address_id` integer,
	`crawl_status` text DEFAULT 'discovered' NOT NULL,
	`error_message` text,
	`imported_address_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawl_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`smarty_source_address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`imported_address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "crawl_discovered_rdi_check" CHECK("crawl_discovered_addresses"."rdi" IS NULL OR "crawl_discovered_addresses"."rdi" IN ('Residential', 'Commercial')),
	CONSTRAINT "crawl_discovered_cmra_check" CHECK("crawl_discovered_addresses"."cmra" IS NULL OR "crawl_discovered_addresses"."cmra" IN ('Yes', 'No')),
	CONSTRAINT "crawl_discovered_status_check" CHECK("crawl_discovered_addresses"."crawl_status" IN ('discovered', 'mailbox_fetched', 'smarty_reused', 'smarty_pending', 'smarty_failed', 'imported', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_discovered_task_url_unique` ON `crawl_discovered_addresses` (`task_id`,`anytime_url`);--> statement-breakpoint
CREATE INDEX `crawl_discovered_task_id_idx` ON `crawl_discovered_addresses` (`task_id`);--> statement-breakpoint
CREATE INDEX `crawl_discovered_anytime_url_idx` ON `crawl_discovered_addresses` (`anytime_url`);--> statement-breakpoint
CREATE INDEX `crawl_discovered_normalized_key_idx` ON `crawl_discovered_addresses` (`normalized_address_key`);--> statement-breakpoint
CREATE INDEX `crawl_discovered_status_idx` ON `crawl_discovered_addresses` (`crawl_status`);--> statement-breakpoint
CREATE INDEX `crawl_discovered_imported_address_idx` ON `crawl_discovered_addresses` (`imported_address_id`);