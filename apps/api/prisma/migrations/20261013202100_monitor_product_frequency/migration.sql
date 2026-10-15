ALTER TABLE `monitors`
    MODIFY `frequency_min` ENUM('m5', 'm10', 'm15', 'm30') NOT NULL DEFAULT 'm30';

CREATE UNIQUE INDEX `monitors_user_id_product_id_config_id_key`
    ON `monitors`(`user_id`, `product_id`, `config_id`);
