CREATE TABLE `address_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address_id` integer,
	`event_type` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `address_events_address_id_idx` ON `address_events` (`address_id`);--> statement-breakpoint
CREATE INDEX `address_events_event_type_idx` ON `address_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `address_events_created_at_idx` ON `address_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `address_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address_id` integer NOT NULL,
	`type` text DEFAULT 'street_view' NOT NULL,
	`file_name` text NOT NULL,
	`public_url` text NOT NULL,
	`original_file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`alt_text` text,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `address_images_address_id_idx` ON `address_images` (`address_id`);--> statement-breakpoint
CREATE INDEX `address_images_primary_idx` ON `address_images` (`is_primary`);--> statement-breakpoint
CREATE TABLE `addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text DEFAULT 'anytimemailbox' NOT NULL,
	`source_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`anytime_url` text NOT NULL,
	`signup_url` text,
	`google_maps_url` text,
	`country` text DEFAULT 'United States' NOT NULL,
	`state` text NOT NULL,
	`state_name` text NOT NULL,
	`city` text NOT NULL,
	`street_address` text NOT NULL,
	`postal_code` text NOT NULL,
	`full_address` text NOT NULL,
	`price_cents` integer NOT NULL,
	`price_currency` text DEFAULT 'USD' NOT NULL,
	`price_period` text DEFAULT 'month' NOT NULL,
	`rdi` text NOT NULL,
	`cmra` text NOT NULL,
	`smarty_raw` text,
	`smarty_checked_at` text,
	`mailbox_min` integer,
	`mailbox_max` integer,
	`mailbox_count` integer,
	`mailbox_numbers_json` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`status_note` text,
	`last_crawled_at` text,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`removed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "addresses_rdi_check" CHECK("addresses"."rdi" IN ('Residential', 'Commercial')),
	CONSTRAINT "addresses_cmra_check" CHECK("addresses"."cmra" IN ('Yes', 'No'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addresses_anytime_url_unique` ON `addresses` (`anytime_url`);--> statement-breakpoint
CREATE INDEX `addresses_slug_idx` ON `addresses` (`slug`);--> statement-breakpoint
CREATE INDEX `addresses_state_idx` ON `addresses` (`state`);--> statement-breakpoint
CREATE INDEX `addresses_city_idx` ON `addresses` (`city`);--> statement-breakpoint
CREATE INDEX `addresses_postal_code_idx` ON `addresses` (`postal_code`);--> statement-breakpoint
CREATE INDEX `addresses_rdi_idx` ON `addresses` (`rdi`);--> statement-breakpoint
CREATE INDEX `addresses_cmra_idx` ON `addresses` (`cmra`);--> statement-breakpoint
CREATE INDEX `addresses_featured_idx` ON `addresses` (`is_featured`);--> statement-breakpoint
CREATE INDEX `addresses_active_idx` ON `addresses` (`is_active`);--> statement-breakpoint
CREATE INDEX `addresses_visible_idx` ON `addresses` (`is_visible`);--> statement-breakpoint
CREATE INDEX `addresses_price_cents_idx` ON `addresses` (`price_cents`);--> statement-breakpoint
CREATE INDEX `addresses_updated_at_idx` ON `addresses` (`updated_at`);--> statement-breakpoint
CREATE TABLE `states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`country` text DEFAULT 'United States' NOT NULL,
	`anytime_url` text NOT NULL,
	`location_count` integer DEFAULT 0 NOT NULL,
	`active_address_count` integer DEFAULT 0 NOT NULL,
	`residential_count` integer DEFAULT 0 NOT NULL,
	`last_crawled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `states_code_unique` ON `states` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `states_slug_unique` ON `states` (`slug`);