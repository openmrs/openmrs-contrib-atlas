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


--
-- Dumping data for table `admin`
--

LOCK TABLES `admin` WRITE;
/*!40000 ALTER TABLE `admin` DISABLE KEYS */;
INSERT INTO `admin` VALUES (1,'shekhar','openmrs_id:shekhar');
/*!40000 ALTER TABLE `admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `atlas`
--

LOCK TABLES `atlas` WRITE;
/*!40000 ALTER TABLE `atlas` DISABLE KEYS */;
INSERT INTO `atlas` VALUES ('0f6c52fa-16d7-46a4-a996-ed68110b20df','39.77864','-86.17785','Regenstrief Institute','http://www.regenstrief.org/','Research',NULL,0,0,0,'Burke Mamlin','abc@def.com','','Burkes site',SUBDATE(CURDATE(), 30*3),SUBDATE(CURDATE(), 30*3),'testadmin',1,'',NULL),
('8377dd8e-f5d4-4837-b566-34af072af666','-30.054213','27.854214','Partners In Health','http://www.pih.org/','Clinical',NULL,0,0,0,'Darius Jazayeri','def@ghi.com','','Darius site',SUBDATE(CURDATE(), 30*9),SUBDATE(CURDATE(), 30*9),'test',1,'',NULL),
('dcac29b9-7295-48f2-b1f6-e32a251e443b','13.6552','-9.0256','Mali Health Organizing Project','http://www.malihealth.org/','Clinical',NULL,0,0,0,'Me','ghi@jkl.com','','My site',SUBDATE(CURDATE(), 30*15),SUBDATE(CURDATE(), 30*15),'testadmin',1,'',NULL),
('da3d5336-0c5f-4df4-a2a0-646750f8739d','13.6552','9.0256','Real Hospital','http://www.google.org/','Clinical',NULL,0,0,0,'Not me','jkl@mno.com','','Not my site',SUBDATE(CURDATE(), 30*21),SUBDATE(CURDATE(), 30*21),'test',1,'',NULL),
('7ed46521-5e48-4b42-96f3-1bfb837ca345','30.6552','59.0256','Téstè mañana','http://www.google-test.org/','Clinical',NULL,0,0,0,'Neo','mno@pqr.com','','Neos site',SUBDATE(CURDATE(), 30*27),SUBDATE(CURDATE(), 30*27),'testadmin',1,'',NULL);
/*!40000 ALTER TABLE `atlas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `auth`
--

LOCK TABLES `auth` WRITE, `atlas` WRITE;
/*!40000 ALTER TABLE `auth` DISABLE KEYS */;
INSERT INTO `auth`(`atlas_id`,`principal`,`token`,`privileges`,`expires`) SELECT `id`,`created_by`,NULL,'ALL',NULL FROM `atlas`;
/*!40000 ALTER TABLE `auth` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `distributions`
--

LOCK TABLES `distributions` WRITE;
/*!40000 ALTER TABLE `distributions` DISABLE KEYS */;
INSERT INTO `distributions` VALUES (1,'OpenMRS 1.x','2016-05-25 13:35:49',1),(2,'Reference Application 2.x','2016-05-25 13:35:49',1),(3,'Bahmni','2016-05-25 13:35:49',1),(4,'KenyaEMR','2016-05-25 13:35:49',1),(6,'others','2016-07-13 18:20:58',0);
/*!40000 ALTER TABLE `distributions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `types`
--

LOCK TABLES `types` WRITE;
/*!40000 ALTER TABLE `types` DISABLE KEYS */;
INSERT INTO `types` VALUES (1,'Research','https://maps.google.com/intl/en_us/mapfiles/ms/micons/green-dot.png'),
(2,'Clinical','https://maps.google.com/intl/en_us/mapfiles/ms/micons/purple-dot.png'),
(3,'Development','https://maps.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png'),
(4,'Evaluation','https://maps.google.com/intl/en_us/mapfiles/ms/micons/yellow-dot.png'),
(5,'Other','https://maps.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png');
/*!40000 ALTER TABLE `types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `types`
--

LOCK TABLES `versions` WRITE;
/*!40000 ALTER TABLE `versions` DISABLE KEYS */;
INSERT INTO `versions` VALUES (1,'1.9'),
(2,'1.10'),
(3,'1.11'),
(4,'2.0'),
(5,'2.1'),
(6,'2.2'),
(7,'2.3'),
(8,'2.4'),
(9,'2.5'),
(10,'2.6'),
(11,'2.7'),
(12,'2.8'),
(13,'2.9');
/*!40000 ALTER TABLE `versions` ENABLE KEYS */;
UNLOCK TABLES;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-07-14  6:17:09
