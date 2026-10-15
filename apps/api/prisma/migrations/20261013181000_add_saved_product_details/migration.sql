ALTER TABLE `products`
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `current_price` DECIMAL(12, 2) NULL,
    ADD COLUMN `previous_price` DECIMAL(12, 2) NULL,
    ADD COLUMN `images` JSON NULL;
