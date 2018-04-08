-- MySQL dump 10.13  Distrib 5.5.49, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: atlasdb
-- ------------------------------------------------------
-- Server version	5.5.49-0ubuntu0.14.04.1

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
-- Table structure for table `admin`
--

Use atlasdb;

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `token` varchar(1024) NOT NULL,
  `principal` varchar(1024) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `archive`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `archive` (
  `site_uuid` varchar(38) DEFAULT NULL,
  `latitude` varchar(50) NOT NULL,
  `longitude` varchar(50) NOT NULL,
  `name` varchar(1024) NOT NULL,
  `url` varchar(1024) DEFAULT NULL,
  `type` varchar(1024) NOT NULL,
  `image` varchar(1024) DEFAULT NULL,
  `patients` int(11) DEFAULT NULL,
  `encounters` int(11) DEFAULT NULL,
  `observations` int(11) DEFAULT NULL,
  `contact` varchar(1024) DEFAULT NULL,
  `email` varchar(1024) DEFAULT NULL,
  `notes` text,
  `data` text,
  `atlas_version` varchar(50) DEFAULT NULL,
  `date_created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `archive_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by` varchar(1024) DEFAULT NULL,
  `created_by` varchar(1024) DEFAULT NULL,
  `show_counts` tinyint(1) NOT NULL DEFAULT '1',
  `id` varchar(38) NOT NULL,
  `action` enum('DELETE','UPDATE','ADD') DEFAULT NULL,
  `openmrs_version` varchar(50) NOT NULL,
  `distribution_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `atlas`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `atlas` (
  `id` varchar(38) NOT NULL,
  `latitude` varchar(50) NOT NULL,
  `longitude` varchar(50) NOT NULL,
  `name` varchar(1024) NOT NULL,
  `url` varchar(1024) DEFAULT NULL,
  `type` varchar(1024) NOT NULL,
  `image` varchar(1024) DEFAULT NULL,
  `patients` int(11) DEFAULT NULL,
  `encounters` int(11) DEFAULT NULL,
  `observations` int(11) DEFAULT NULL,
  `contact` varchar(1024) DEFAULT NULL,
  `email` varchar(1024) DEFAULT NULL,
  `notes` text,
  `data` text,
  `atlas_version` varchar(50) DEFAULT NULL,
  `date_created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `date_changed` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(255) DEFAULT NULL,
  `show_counts` tinyint(1) NOT NULL DEFAULT '1',
  `openmrs_version` varchar(50) NOT NULL,
  `distribution` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `atlas_distribution_foreign` (`distribution`),
  CONSTRAINT `atlas_distribution_foreign` FOREIGN KEY (`distribution`) REFERENCES `distributions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `atlas_id` varchar(38) NOT NULL,
  `principal` varchar(1024) NOT NULL,
  `token` varchar(1024) DEFAULT NULL,
  `privileges` varchar(1024) DEFAULT 'ALL',
  `expires` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `auth_atlas_id_foreign` (`atlas_id`),
  CONSTRAINT `auth_atlas_id_foreign` FOREIGN KEY (`atlas_id`) REFERENCES `atlas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=161 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `distributions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `distributions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_standard` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migrations`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
