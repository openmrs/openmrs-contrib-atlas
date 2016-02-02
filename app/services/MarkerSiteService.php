<?php


class MarkerSiteService
{

    public static function archiveSite($site, $date, $changedBy, $action, $archiveDistribution)
    {
        $row = $site;
        $row["action"] = $action;
        $row["archive_date"] = $date;
        $row["changed_by"] = $changedBy;
        $row["site_uuid"] = $site['id'];
        $row["id"] = Uuid::uuid4()->toString();
        $row['distribution'] = $archiveDistribution;

        //$site is row to update from atlas table, which contains extra column "date_changed"
        unset($row["date_changed"]);

        DB::table('archive')->insert($row);

    }

}