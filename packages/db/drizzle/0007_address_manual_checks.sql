ALTER TABLE `addresses` ADD COLUMN `usps_cmra` text CONSTRAINT `addresses_usps_cmra_check` CHECK (`usps_cmra` IS NULL OR `usps_cmra` IN ('Y', 'N'));
--> statement-breakpoint
ALTER TABLE `addresses` ADD COLUMN `usps_cmra_updated_at` text;
--> statement-breakpoint
ALTER TABLE `addresses` ADD COLUMN `c1_precheck` text CONSTRAINT `addresses_c1_precheck_check` CHECK (`c1_precheck` IS NULL OR `c1_precheck` IN ('pass', 'fail'));
--> statement-breakpoint
ALTER TABLE `addresses` ADD COLUMN `c1_precheck_updated_at` text;
--> statement-breakpoint
CREATE INDEX `addresses_usps_cmra_idx` ON `addresses` (`usps_cmra`);
--> statement-breakpoint
CREATE INDEX `addresses_c1_precheck_idx` ON `addresses` (`c1_precheck`);
