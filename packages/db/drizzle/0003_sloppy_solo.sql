CREATE TABLE `crawl_tasks` (
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
	CONSTRAINT "crawl_tasks_created_type_check" CHECK("crawl_tasks"."created_type" IN ('manual', 'system')),
	CONSTRAINT "crawl_tasks_status_check" CHECK("crawl_tasks"."status" IN ('running', 'completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_tasks_batch_code_unique` ON `crawl_tasks` (`batch_code`);--> statement-breakpoint
CREATE INDEX `crawl_tasks_generated_at_idx` ON `crawl_tasks` (`generated_at`);--> statement-breakpoint
CREATE INDEX `crawl_tasks_created_type_idx` ON `crawl_tasks` (`created_type`);--> statement-breakpoint
CREATE INDEX `crawl_tasks_status_idx` ON `crawl_tasks` (`status`);--> statement-breakpoint
CREATE TABLE `crawl_subtasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`task_type` text NOT NULL,
	`execution_status` text DEFAULT 'pending' NOT NULL,
	`result_status` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawl_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "crawl_subtasks_task_type_check" CHECK("crawl_subtasks"."task_type" IN ('fetch_states', 'fetch_names', 'fetch_addresses', 'fetch_mailbox_numbers', 'sync_smarty')),
	CONSTRAINT "crawl_subtasks_execution_status_check" CHECK("crawl_subtasks"."execution_status" IN ('pending', 'running', 'completed')),
	CONSTRAINT "crawl_subtasks_result_status_check" CHECK("crawl_subtasks"."result_status" IS NULL OR "crawl_subtasks"."result_status" IN ('success', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `crawl_subtasks_task_id_idx` ON `crawl_subtasks` (`task_id`);--> statement-breakpoint
CREATE INDEX `crawl_subtasks_task_type_idx` ON `crawl_subtasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `crawl_subtasks_execution_status_idx` ON `crawl_subtasks` (`execution_status`);--> statement-breakpoint
CREATE INDEX `crawl_subtasks_result_status_idx` ON `crawl_subtasks` (`result_status`);
