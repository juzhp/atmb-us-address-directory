PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `crawl_tasks_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_code` text NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`pending_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "crawl_tasks_created_type_check" CHECK("crawl_tasks_new"."created_type" IN ('manual', 'system')),
	CONSTRAINT "crawl_tasks_status_check" CHECK("crawl_tasks_new"."status" IN ('running', 'pause_requested', 'paused', 'stop_requested', 'stopped', 'completed'))
);
--> statement-breakpoint
INSERT INTO `crawl_tasks_new` (
	`id`, `batch_code`, `generated_at`, `created_type`, `status`, `note`, `created_by`,
	`pending_count`, `success_count`, `failed_count`, `total_count`, `created_at`, `updated_at`
)
SELECT
	`id`, `batch_code`, `generated_at`, `created_type`, `status`, `note`, `created_by`,
	`pending_count`, `success_count`, `failed_count`, `total_count`, `created_at`, `updated_at`
FROM `crawl_tasks`;
--> statement-breakpoint
DROP TABLE `crawl_tasks`;
--> statement-breakpoint
ALTER TABLE `crawl_tasks_new` RENAME TO `crawl_tasks`;
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_tasks_batch_code_unique` ON `crawl_tasks` (`batch_code`);
--> statement-breakpoint
CREATE INDEX `crawl_tasks_generated_at_idx` ON `crawl_tasks` (`generated_at`);
--> statement-breakpoint
CREATE INDEX `crawl_tasks_created_type_idx` ON `crawl_tasks` (`created_type`);
--> statement-breakpoint
CREATE INDEX `crawl_tasks_status_idx` ON `crawl_tasks` (`status`);
--> statement-breakpoint
CREATE TABLE `crawl_subtasks_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`task_type` text NOT NULL,
	`execution_status` text DEFAULT 'pending' NOT NULL,
	`result_status` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawl_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "crawl_subtasks_task_type_check" CHECK("crawl_subtasks_new"."task_type" IN ('fetch_states', 'fetch_names', 'fetch_addresses', 'fetch_mailbox_numbers', 'sync_smarty')),
	CONSTRAINT "crawl_subtasks_execution_status_check" CHECK("crawl_subtasks_new"."execution_status" IN ('pending', 'running', 'paused', 'completed')),
	CONSTRAINT "crawl_subtasks_result_status_check" CHECK("crawl_subtasks_new"."result_status" IS NULL OR "crawl_subtasks_new"."result_status" IN ('success', 'failed', 'stopped'))
);
--> statement-breakpoint
INSERT INTO `crawl_subtasks_new` (
	`id`, `task_id`, `task_type`, `execution_status`, `result_status`, `error_message`, `created_at`, `updated_at`
)
SELECT
	`id`, `task_id`, `task_type`, `execution_status`, `result_status`, `error_message`, `created_at`, `updated_at`
FROM `crawl_subtasks`;
--> statement-breakpoint
DROP TABLE `crawl_subtasks`;
--> statement-breakpoint
ALTER TABLE `crawl_subtasks_new` RENAME TO `crawl_subtasks`;
--> statement-breakpoint
CREATE INDEX `crawl_subtasks_task_id_idx` ON `crawl_subtasks` (`task_id`);
--> statement-breakpoint
CREATE INDEX `crawl_subtasks_task_type_idx` ON `crawl_subtasks` (`task_type`);
--> statement-breakpoint
CREATE INDEX `crawl_subtasks_execution_status_idx` ON `crawl_subtasks` (`execution_status`);
--> statement-breakpoint
CREATE INDEX `crawl_subtasks_result_status_idx` ON `crawl_subtasks` (`result_status`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
