ALTER TABLE `monitors`
    DROP FOREIGN KEY `monitors_config_id_fkey`,
    MODIFY `config_id` CHAR(36) NULL,
    ADD COLUMN `extraction_mode` ENUM('manual', 'automatic') NOT NULL DEFAULT 'manual';

ALTER TABLE `monitors`
    ADD CONSTRAINT `monitors_config_id_fkey`
    FOREIGN KEY (`config_id`) REFERENCES `scrape_configs`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
