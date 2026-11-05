
SELECT
    0 AS SlNo,
    d.districtname,
    fta.FACTYPENAME,
    fm.facilityid,
    fm.facilityname,
    CASE
        WHEN ai.status = 'C' THEN 'Annual Indent Uploaded and Forwarded'
        WHEN ai.status = 'I' THEN 'Annual Indent Uploaded but not Forwarded'
        ELSE 'Indent Not Uploaded'
    END AS status,
    ai.AIcategoryid,
    NVL(
        sc.catname || ' (' || mc.categoryname || ')',
        (
            SELECT sc2.catname || ' (' || mc2.categoryname || ')'
            FROM MasSubItemCategory sc2
            INNER JOIN masitemcategories mc2
                ON mc2.categoryid = sc2.categoryid
            WHERE sc2.subcatid = 58
        )
    ) AS categoryname
FROM masfacilities fm

LEFT OUTER JOIN (
    SELECT
        facilityid,
        status,
        AIcategoryid
    FROM masanualindent
    WHERE accyrsetid = 54
      AND AIcategoryid = 58
) ai
    ON ai.facilityid = fm.facilityid

INNER JOIN masdistricts d
    ON d.districtid = fm.districtid

INNER JOIN masfacilitytypes ft
    ON ft.facilitytypeid = fm.facilitytypeid

INNER JOIN masfacilitytypeayush fta
    ON fta.FACTYPEID = fm.AYFACTYPEID

LEFT OUTER JOIN MasSubItemCategory sc
    ON sc.SUBCATID = ai.AIcategoryid

LEFT OUTER JOIN masitemcategories mc
    ON mc.categoryid = sc.categoryid

WHERE fm.isactive = 1
  AND fm.facilitytypeid = 371
  AND fm.districtid IN (
      SELECT districtid
      FROM masfacilities
      WHERE facilityid = 23633
  )
  AND fm.facilityid NOT IN (23633)

ORDER BY ft.orderdp, fm.facilityname;
