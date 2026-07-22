const db = require('../config/db');
const oracledb = require('oracledb');

async function getPendingNocItems(facilityId) {
  const query = `
SELECT
    mn.nocid,
    mn.nocnumber,
    mn.nocdate,
    TO_CHAR(mn.nocdate, 'DD-MM-YYYY') AS NOCDATEA,
    f.facilityname,
    m.itemcode,
    m.itemname,
    m.strength1,
    m.unit,
    m.unitcount,
    m.itemid,
    mi.approvedqty AS NOCQTYNOS,
    mi.itemremarks,
    nvl(whs.CurrentStock,0) as FACCURRENTSTOCK,
    mi.ISCMHOAPR,
    mi.IsCGMSCAPR,
    mi.sr
FROM mascgmscnoc mn
INNER JOIN mascgmscnocitems mi
    ON mn.nocid = mi.nocid
INNER JOIN masitems m
    ON mi.itemid = m.itemid
INNER JOIN masfacilities f
    ON f.facilityid = mn.facilityid
LEFT OUTER JOIN (
    SELECT itemid,
           SUM(NVL(ReadyForIssue,0)) AS CurrentStock
    FROM (
        SELECT
            b.batchno,
            b.expdate,
            b.inwno,
            t.facilityid,
            i.itemid,
            (CASE
                WHEN b.qastatus='1'
                THEN (NVL(b.absrqty,0) - NVL(iq.issueqty,0))
             END) ReadyForIssue
        FROM tbfacilityreceiptbatches b   
        INNER JOIN tbfacilityreceiptitems i ON b.facreceiptitemid = i.facreceiptitemid 
        INNER JOIN tbfacilityreceipts t ON t.facreceiptid = i.facreceiptid   
        INNER JOIN masfacilities f ON f.facilityid = t.facilityid AND f.isactive = 1
        INNER JOIN masfacilitytypes ft ON ft.facilitytypeid = f.facilitytypeid
        LEFT OUTER JOIN 
        (  
            SELECT fs.facilityid, fsi.itemid, ftbo.inwno, SUM(NVL(ftbo.issueqty,0)) issueqty   
            FROM tbfacilityissues fs 
            INNER JOIN tbfacilityissueitems fsi ON fsi.issueid = fs.issueid 
            INNER JOIN tbfacilityoutwards ftbo ON ftbo.issueitemid = fsi.issueitemid 
            WHERE fs.status = 'C'                 
            GROUP BY fsi.itemid, fs.facilityid, ftbo.inwno                     
        ) iq ON b.inwno = iq.inwno AND iq.itemid = i.itemid AND iq.facilityid = t.facilityid                  
        WHERE t.Status = 'C' AND ft.hodid = 2 
          AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
          AND b.expdate > SYSDATE 
          AND f.districtid IN (
              SELECT DISTINCT districtid
              FROM masfacilities
              WHERE facilityid = :facilityId
          )
    )
    GROUP BY itemid
    HAVING SUM(NVL(ReadyForIssue,0)) > 0
) whs ON whs.itemid = m.itemid
WHERE mn.status = 'C'
  AND mn.nocdate > TO_DATE('01-APR-2026','DD-MON-YYYY')
  AND f.isactive = 1
  AND f.districtid IN (
        SELECT DISTINCT districtid
        FROM masfacilities
        WHERE facilityid = :facilityId
      )
  AND NVL(mi.approvedqty,0) > 0
  AND mi.ISCMHOAPR IS NULL
  AND f.facilitytypeid IN (
        381,386,382,388,372,369,
        354,355,356,357,358,365,379
      )
  AND IssendAPR IS NULL
  AND NVL(mi.IsCGMSCAPR,'N') = 'N'
ORDER BY mn.nocdate, f.facilityname
  `;
  
  const binds = { facilityId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

async function approveItem({ sr, aprQty, remarks, userId, otp, dt1 }) {
  const query = `
    Update MASCGMSCNOCITEMS 
    set ISCMHOAPR='Y',
        CMHOAPRQTY=:aprQty,
        ISCMHOAPRDATE=sysdate,
        CMHOAPRREMARKS=:remarks,
        CMHOUSERID=:userId,
        CMHOOTP=:otp,
        CMHOAppliedDTTime=:dt1 
    where SR=:sr
  `;
  
  const binds = { sr, aprQty, remarks, userId, otp, dt1 };
  await db.execute(query, binds, { autoCommit: true });
}

async function rejectItem({ sr, remarks, userId, otp, dt1 }) {
  const query = `
    Update MASCGMSCNOCITEMS 
    set FACREQQTY=APPROVEDQTY, 
        APPROVEDQTY=0, 
        ISCMHOAPR='N',
        CMHOAPRQTY=0,
        ISCMHOAPRDATE=sysdate,
        CMHOAPRREMARKS=:remarks,
        Cgmsclremarks=:remarks,
        CMHOUSERID=:userId,
        CMHOOTP=:otp,
        CMHOAppliedDTTime=:dt1 
    where SR=:sr
  `;
  
  const binds = { sr, remarks, userId, otp, dt1 };
  await db.execute(query, binds, { autoCommit: true });
}

async function getFacilityWiseCurrentStock(facilityId, itemId) {
  const query = `
    SELECT itemid, facilityname, itemcode, itemname, strength1, unit, SUM(NVL(ReadyForIssue,0)) AS CurrentStock
    FROM (
        SELECT
            b.batchno,
            b.expdate,
            b.inwno,
            t.facilityid,
            f.facilityname,
            m.itemcode,
            m.itemname,
            m.strength1,
            m.unit,
            i.itemid,
            (CASE WHEN b.qastatus ='1' THEN (NVL(b.absrqty,0) - NVL(iq.issueqty,0)) END) ReadyForIssue
        FROM tbfacilityreceiptbatches b   
        INNER JOIN tbfacilityreceiptitems i ON b.facreceiptitemid = i.facreceiptitemid 
        INNER JOIN tbfacilityreceipts t ON t.facreceiptid = i.facreceiptid   
        INNER JOIN masfacilities f ON f.facilityid = t.facilityid AND f.isactive = 1
        INNER JOIN masfacilitytypes ft ON ft.facilitytypeid = f.facilitytypeid
        INNER JOIN masitems m ON m.itemid = i.itemid
        LEFT OUTER JOIN 
        (  
            SELECT fs.facilityid, fsi.itemid, ftbo.inwno, SUM(NVL(ftbo.issueqty,0)) issueqty   
            FROM tbfacilityissues fs 
            INNER JOIN tbfacilityissueitems fsi ON fsi.issueid = fs.issueid 
            INNER JOIN tbfacilityoutwards ftbo ON ftbo.issueitemid = fsi.issueitemid 
            WHERE fs.status = 'C'                 
            GROUP BY fsi.itemid, fs.facilityid, ftbo.inwno                     
        ) iq ON b.inwno = iq.inwno AND iq.itemid = i.itemid AND iq.facilityid = t.facilityid                  
        WHERE 1 = 1 AND ft.hodid = 2 AND t.Status = 'C' 
          AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
          AND b.expdate > SYSDATE 
          AND m.itemid = :itemId
          AND f.districtid IN (
              SELECT DISTINCT districtid  
              FROM masfacilities  
              WHERE facilityid = :facilityId
          )  
    ) 
    GROUP BY itemid, facilityname, itemcode, itemname, strength1, unit
    HAVING SUM(NVL(ReadyForIssue,0)) > 0
    ORDER BY facilityname
  `;
  
  const binds = { facilityId, itemId };
  const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

module.exports = {
  getPendingNocItems,
  approveItem,
  rejectItem,
  getFacilityWiseCurrentStock
};
