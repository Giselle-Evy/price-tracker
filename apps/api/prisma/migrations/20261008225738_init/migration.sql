-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `image_url` TEXT NULL,
    `canonical_url` VARCHAR(768) NOT NULL,
    `original_url` TEXT NOT NULL,
    `domain` VARCHAR(255) NOT NULL,
    `currency` VARCHAR(8) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_canonical_url_key`(`canonical_url`),
    INDEX `products_domain_idx`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offers` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NULL,
    `previous_price` DECIMAL(12, 2) NULL,
    `url` TEXT NOT NULL,
    `source_type` ENUM('manual', 'scraped') NOT NULL DEFAULT 'manual',
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `offers_user_id_idx`(`user_id`),
    INDEX `offers_product_id_idx`(`product_id`),
    INDEX `offers_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scrape_configs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `source_url` TEXT NOT NULL,
    `source_domain` VARCHAR(255) NOT NULL,
    `status` ENUM('draft', 'active', 'error', 'archived') NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scrape_configs_user_id_source_domain_idx`(`user_id`, `source_domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scrape_fields` (
    `id` CHAR(36) NOT NULL,
    `config_id` CHAR(36) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `selector` TEXT NOT NULL,
    `attribute` VARCHAR(80) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `transform` JSON NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    INDEX `scrape_fields_config_id_idx`(`config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitors` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `config_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `url` TEXT NOT NULL,
    `image_url` TEXT NULL,
    `currency` VARCHAR(8) NULL,
    `current_price` DECIMAL(12, 2) NULL,
    `previous_price` DECIMAL(12, 2) NULL,
    `target_price` DECIMAL(12, 2) NULL,
    `status` ENUM('active', 'paused', 'error', 'pending') NOT NULL DEFAULT 'pending',
    `frequency_min` ENUM('m5', 'm15', 'm30') NOT NULL DEFAULT 'm30',
    `alert_on_drop` BOOLEAN NOT NULL DEFAULT true,
    `alert_enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `last_success_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `monitors_user_id_status_idx`(`user_id`, `status`),
    INDEX `monitors_product_id_idx`(`product_id`),
    INDEX `monitors_next_run_at_idx`(`next_run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scrape_runs` (
    `id` CHAR(36) NOT NULL,
    `monitor_id` CHAR(36) NOT NULL,
    `status` ENUM('success', 'partial', 'error') NOT NULL,
    `duration_ms` INTEGER NULL,
    `http_status` INTEGER NULL,
    `error_message` TEXT NULL,
    `raw_snapshot` JSON NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,

    INDEX `scrape_runs_monitor_id_started_at_idx`(`monitor_id`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `monitor_id` CHAR(36) NOT NULL,
    `run_id` CHAR(36) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(8) NULL,
    `observed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_history_monitor_id_observed_at_idx`(`monitor_id`, `observed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `monitor_id` CHAR(36) NOT NULL,
    `type` ENUM('price_drop', 'target_reached', 'error', 'system') NOT NULL,
    `old_price` DECIMAL(12, 2) NULL,
    `new_price` DECIMAL(12, 2) NULL,
    `message` TEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offers` ADD CONSTRAINT `offers_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scrape_configs` ADD CONSTRAINT `scrape_configs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scrape_fields` ADD CONSTRAINT `scrape_fields_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `scrape_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitors` ADD CONSTRAINT `monitors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitors` ADD CONSTRAINT `monitors_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitors` ADD CONSTRAINT `monitors_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `scrape_configs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scrape_runs` ADD CONSTRAINT `scrape_runs_monitor_id_fkey` FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_monitor_id_fkey` FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `scrape_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_monitor_id_fkey` FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
