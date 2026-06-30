CREATE TABLE `proxy_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`note` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_test_status` text DEFAULT 'not_tested' NOT NULL,
	`last_test_message` text,
	`last_test_sample_address` text,
	`last_tested_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "proxy_library_test_status_check" CHECK("proxy_library"."last_test_status" IN ('not_tested', 'success', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proxy_library_url_unique` ON `proxy_library` (`url`);
--> statement-breakpoint
CREATE INDEX `proxy_library_active_idx` ON `proxy_library` (`is_active`);
--> statement-breakpoint
CREATE INDEX `proxy_library_test_status_idx` ON `proxy_library` (`last_test_status`);