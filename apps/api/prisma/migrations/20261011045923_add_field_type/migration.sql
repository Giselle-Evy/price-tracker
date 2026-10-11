-- AlterTable
ALTER TABLE `scrape_fields` ADD COLUMN `type` ENUM('text', 'price', 'image', 'url') NOT NULL DEFAULT 'text';
