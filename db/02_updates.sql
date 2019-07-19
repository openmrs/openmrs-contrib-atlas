-- MySQL dump 10.13  Distrib 5.6.39, for Linux (x86_64)
--
-- Host: localhost    Database: atlasdb
-- ------------------------------------------------------
-- Server version	5.6.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Get rid of 'on update CURRENT_TIMESTAMP' for 'date_changed' on atlas table
--

ALTER TABLE `atlas` MODIFY COLUMN `date_changed` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

--
-- Convert atlas image attribute to mediumblob (ATLAS-178)
--

SET @dbname = DATABASE();
SET @tablename = "atlas";
SET @columnname = "image";
SET @columntype = "mediumblob";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
      AND (data_type <> @columntype)
  ) = 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " CHANGE ", @columnname, " ", @columnname, " ", @columntype, ";")
));
PREPARE alterColumnType FROM @preparedStatement;
EXECUTE alterColumnType;
DEALLOCATE PREPARE alterColumnType;

--
-- Convert archive's image attribute to mediumblob (ATLAS-178)
--

SET @tablename = "archive";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
      AND (data_type <> @columntype)
  ) = 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " CHANGE ", @columnname, " ", @columnname, " ", @columntype, ";")
));
PREPARE alterColumnType FROM @preparedStatement;
EXECUTE alterColumnType;
DEALLOCATE PREPARE alterColumnType;

--
-- Clear image column of atlas and archive
--

UPDATE `atlas` SET image=NULL;
UPDATE `archive` SET image=NULL;

--
-- Add ON DELETE CASCADE to auth's auth_atlas_id_foreign key
--

ALTER TABLE `auth` DROP FOREIGN KEY `auth_atlas_id_foreign`;
ALTER TABLE `auth` ADD CONSTRAINT `auth_atlas_id_foreign` FOREIGN KEY (`atlas_id`) REFERENCES `atlas`(`id`) ON DELETE CASCADE;

--
-- Add auth rules using atlas table
--

DELETE FROM `auth`;
INSERT INTO `auth`(`atlas_id`,`principal`,`token`,`privileges`,`expires`) SELECT `id`,`created_by`,NULL,'ALL',NULL FROM `atlas`;

--
-- Drop atlas_version column for table 'atlas'
--

SET @tablename = "atlas";
SET @columnname = "atlas_version";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) = 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " DROP COLUMN ", @columnname, ";")
));
PREPARE alterColumnType FROM @preparedStatement;
EXECUTE alterColumnType;
DEALLOCATE PREPARE alterColumnType;

--
-- Drop atlas_version column for table 'archive'
--

SET @tablename = "archive";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) = 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " DROP COLUMN ", @columnname, ";")
));
PREPARE alterColumnType FROM @preparedStatement;
EXECUTE alterColumnType;
DEALLOCATE PREPARE alterColumnType;

--
-- Table structure for table `rss`
--

DROP TABLE IF EXISTS `rss`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rss` (
  `id` INT(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(1024) NOT NULL,
  `description` VARCHAR(4096) NOT NULL,
  `author` VARCHAR(1024) NOT NULL,
  `url` varchar(1024) COLLATE utf8_unicode_ci DEFAULT NULL,
  `image_url` varchar(1024) COLLATE utf8_unicode_ci DEFAULT NULL,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-04-08  7:53:27
