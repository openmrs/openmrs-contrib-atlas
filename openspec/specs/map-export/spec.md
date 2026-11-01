# map-export Specification

## Purpose
Lets people take Atlas data and images out of the site: open data downloads for reuse, and slide-ready images of the map as they see it.

## Requirements
### Requirement: Public data downloads
The site SHALL offer the current published markers as CSV and GeoJSON downloads from stable URLs, without sign-in. Downloads SHALL contain only public marker fields.

#### Scenario: Download CSV
- **WHEN** a visitor chooses "Download data (CSV)"
- **THEN** they receive a CSV file with one row per published marker and no contact or owner fields

#### Scenario: Stable URL
- **WHEN** a script fetches the GeoJSON download URL on two different days
- **THEN** both requests succeed at the same URL and return the snapshot current at that time

### Requirement: Image download of the current view
Visitors SHALL be able to download the current map view, with its markers, clusters, colouring and filters, as a PNG at 1x, 2x or 4x the on-screen pixel size.

#### Scenario: 4x download
- **WHEN** a visitor viewing a 1280 × 720 map chooses PNG at 4x
- **THEN** they receive a 5120 × 2880 PNG of the same area, markers and colours

#### Scenario: Filters respected
- **WHEN** a visitor has filtered to Clinical markers and downloads an image
- **THEN** the image shows only Clinical markers

### Requirement: Image options
Before downloading an image, visitors SHALL be able to include or leave out a title (default "OpenMRS Atlas"), the legend, and the date. Map attribution SHALL always be included.

#### Scenario: Image for a slide
- **WHEN** a visitor turns on the legend and date and leaves the title as default
- **THEN** the PNG shows "OpenMRS Atlas", the legend, today's date and the map attribution

#### Scenario: Attribution cannot be removed
- **WHEN** a visitor turns off title, legend and date
- **THEN** the PNG still includes the map attribution

### Requirement: Image file naming
Downloaded images SHALL be named `openmrs-atlas-<YYYY-MM-DD>.png` and data files `openmrs-atlas-<YYYY-MM-DD>.csv` or `.geojson`, using the visitor's local date.

#### Scenario: File name
- **WHEN** a visitor downloads an image on 2026-11-03
- **THEN** the file is named `openmrs-atlas-2026-11-03.png`
