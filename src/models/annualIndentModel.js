const db = require('../config/db');
const oracledb = require('oracledb');

// Import separated specialized models
const dhAnnualIndentModel = require('./dhAnnualIndentModel');
const nonEdlAnnualIndentModel = require('./nonEdlAnnualIndentModel');
const reagentNonEdlIndentModel = require('./reagentNonEdlIndentModel');
const ayushAnnualIndentModel = require('./ayushAnnualIndentModel');
const medicalCollegeAiModel = require('./medicalCollegeAiModel');
const chcAnnualIndentModel = require('./chcAnnualIndentModel');

// Fetch items for the dropdown
async function getIndentItems(facilityId) {
  try {
    const query = `
      select Distinct r.itemid, SUBSTR(m.itemcode || '-' || itemname, 1, 70) itemname,
      round(nvl(r.dhsaprqty,0),0) dhsapr, round(nvl(cmhodistqty,0),0) cmhodistqty,
      round((nvl(r.dhsaprqty,0)-nvl(cmhodistqty,0)),0) bal, m.edlcat, m.itemcode
      from revisedannualindentitem r 
      inner join masitems m on m.itemid=r.itemid
      left outer join masedl e on e.edlcat=m.edlcat
      left outer join 
      (
        select itemid, f.districtid, sum(nvl(cmhodistqty,0)) cmhodistqty 
        from anualindent a 
        inner join masfacilities f on f.facilityid=a.facilityid
        where f.isactive=1 and a.accyrsetid=547 and f.districtid in (select distinct districtid from masfacilities where facilityid=:facilityId) 
        group by itemid, f.districtid
      ) x on x.itemid= r.itemid and x.districtid=r.districtid
      where r.dhsaprqty>0 and r.accyrsetid=547 and r.facilityid=:facilityId 
      and (nvl(r.dhsaprqty,0)-nvl(cmhodistqty,0))>0  
      order by m.itemcode
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching indent items:', error);
    throw error;
  }
}

// Fetch the balance distribution quantity summary
async function getIndentSummary(facilityId, itemId) {
  try {
    const query = `
      select r.districtid, sum(round(r.dhsaprqty,0)) dhsaprqty,
      round(nvl(cmhodistqty,0),0) cmhodistqty,
      round((sum(round(r.dhsaprqty,0))-nvl(cmhodistqty,0)),0) balqty,
      e.edl, r.itemid, r.itemcode
      from revisedannualindentitem r
      left outer join 
      (
        select itemid, f.districtid, sum(nvl(cmhodistqty,0)) cmhodistqty 
        from anualindent a 
        inner join masfacilities f on f.facilityid=a.facilityid
        where f.isactive=1 and a.accyrsetid=547 and f.districtid in (select distinct districtid from masfacilities where facilityid=${facilityId}) 
        and itemid=${itemId}
        group by itemid, f.districtid
      ) x on x.itemid= r.itemid and x.districtid=r.districtid
      inner join masitems m on m.itemid=r.itemid
      left outer join masedl e on e.edlcat=m.edlcat
      where r.dhsaprqty>0 and r.accyrsetid=547 and r.facilityid=${facilityId} and r.itemid=${itemId}
      group by r.districtid, cmhodistqty, e.edl, r.itemid, r.itemcode
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching indent summary:', error);
    throw error;
  }
}

// Fetch the facilities grid with their distributed quantities
async function getFacilityDistributions(facilityId, itemId) {
  try {
    const query = `
      select f.facilityid, f.facilityname, f.facilitycode, 
      case when a.indentid is null then 0 else a.indentid end as issueitemid,
      round(nvl(cmhodistqty,0),0) cmhodistqty, round(nvl(FACILITYINDENTQTY,0),0) FACILITYINDENTQTY
      from masfacilities f 
      left outer join 
      (
        select a.facilityid, a.indentid, sum(nvl(cmhodistqty,0)) cmhodistqty, sum(nvl(FACILITYINDENTQTY,0)) FACILITYINDENTQTY 
        from anualindent a 
        where a.accyrsetid=547 and itemid=${itemId}
        group by a.facilityid, a.indentid
      ) a on a.facilityid=f.facilityid
      where f.isactive=1 and f.districtid in (select distinct districtid from masfacilities where facilityid=${facilityId}) 
      and f.facilitytypeid not in (367,378,377,364,368,369)
      order by f.facilityname
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching distributions:', error);
    throw error;
  }
}

// Insert new distribution
async function insertDistribution(indentId, targetFacilityId, itemId, itemCode, distQty) {
  try {
    const query = `
      insert into anualindent(indentid, facilityid, itemid, itemcode, cmhodistqty, accyrsetid) 
      values(:indentId, :targetFacilityId, :itemId, :itemCode, :distQty, 547)
    `;
    await db.execute(query, { indentId, targetFacilityId, itemId, itemCode, distQty }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error inserting distribution:', error);
    throw error;
  }
}

// Update existing distribution
async function updateDistribution(issueItemId, distQty) {
  try {
    const query = `
      update anualindent set cmhodistqty=:distQty where indentid=:issueItemId
    `;
    await db.execute(query, { distQty, issueItemId }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error updating distribution:', error);
    throw error;
  }
}

// Delete a distribution
async function deleteDistribution(issueItemId) {
  try {
    const query = `
      delete from anualindent where indentid=:issueItemId
    `;
    await db.execute(query, { issueItemId }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting distribution:', error);
    throw error;
  }
}

// Annual Indent Excel Download Format Data (DHS / General Format Query OR DME Query)
async function getDownloadAiFormatData(facilityId, categoryId, facilityTypeId) {
  try {
    const usrFacilityID = Number(facilityId) || 23393;
    const inputCatId = Number(categoryId) || 0;

    let isDme = false;
    const cleanFacTypeId = facilityTypeId !== undefined && facilityTypeId !== null ? String(facilityTypeId).trim() : '';
    if (cleanFacTypeId === '364' || cleanFacTypeId === '378') {
      isDme = true;
    } else {
      const facCheckRes = await db.execute(
        `SELECT f.facilitytypeid, t.facilitytypecode 
         FROM masfacilities f 
         LEFT JOIN masfacilitytypes t ON t.facilitytypeid = f.facilitytypeid 
         WHERE f.facilityid = :usrFacilityID`,
        { usrFacilityID },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (facCheckRes.rows && facCheckRes.rows[0]) {
        const ftId = String(facCheckRes.rows[0].FACILITYTYPEID || facCheckRes.rows[0].facilitytypeid || '');
        const ftCode = String(facCheckRes.rows[0].FACILITYTYPECODE || facCheckRes.rows[0].facilitytypecode || '').toUpperCase();
        if (ftId === '364' || ftId === '378' || ftCode.includes('DME')) {
          isDme = true;
        }
      }
    }

    if (isDme) {
      const dmeQuery = `
        select 0 SlNo,Formate.itemcode,Formate.itemname,Formate.Formulation,Formate.Strength,Formate.GroupName,
          Formate.edl,nvl(Consumption.COSUMPTION_From_1APR_25,'0') COSUMPTION_From_1APR_26, nvl(cr.CurStock,0) as Current_Stock,INDENT_26_27  as INDENT_27_28
    ,nvl(vr.singlerate,0) as Rate,Formate.unitcount as PACKAGINGUNIT,Formate.categoryname,
    Formate.EDLType
          from
          (
          select 0 SlNo ,m.itemcode,m.ItemID,case when length(m.itemname)>100 
          then substr(m.itemname,0,100) else itemname end itemname,t.itemtypename Formulation,
          case when length(m.strength1)>100 then substr(m.strength1,0,100) else m.strength1 
          end Strength,g.groupname GroupName,e.edl, 
                0 COSUMPTION_From_1APR_25,0 INDENT_26_27   ,m.unitcount ,mc.mcid,mt.categoryname,
                CASE 
                    WHEN m.EDL2025 = 'Y' 
                     AND (m.edl2025flag = 'COMMON' OR m.edl2025flag = 'CME' OR m.edl2025flag = 'DME') 
                    THEN 'EDL' 
                    ELSE 'Non EDL' 
                END AS EDLType  
                from masitems m inner join masitemgroups g on m.groupid=g.groupid  
                inner join masitemcategories mt on mt.categoryid=m.categoryid 
                inner join masitemmaincategory mc on mc.mcid=mt.mcid
                inner join masedl e on e.edlcat=m.edlcat 
                inner join masitemtypes t on t.itemtypeid=m.itemtypeid where mt.categoryid 
                in(52,53,54,55) and m.EDL2025='Y' and m.EDL2025FLAG in ('COMMON','CME') and m.isfreez_itpr is null
                ) Formate
          left outer join 
          (
            select  edlitemcode as itemcode, sum(iss_qty) COSUMPTION_From_1APR_25
            from 
            (
              select tb.issueid,tbi.itemid,tbi.ISSUEITEMID,m.edlitemcode, sum(tbo.issueqty) iss_qty ,m.unitcount
              from tbfacilityissues tb 
              inner join tbfacilityissueitems tbi on tbi.issueid=tb.issueid
              inner join tbfacilityoutwards tbo on tbo.ISSUEITEMID=tbi.ISSUEITEMID
              inner join tbfacilityreceiptbatches rb on rb.inwno=tbo.inwno
              inner join vmasitems m on m.itemid=tbi.itemid
              where tb.status='C' and tb.facilityid= :usrFacilityID
              and tb.issuedate between (select startdate from masaccyearsettings where accyrsetId=546) 
              and (select enddate from masaccyearsettings where accyrsetId=546)
              group by tb.issueid,tbi.itemid,tbi.ISSUEITEMID,m.edlitemcode,m.unitcount
            ) i group by edlitemcode
          ) Consumption on Consumption.itemcode=Formate.itemcode 
          left outer join 
          (
            select i.itemid, sum(nvl(rb.AbsRqty,0))-sum(nvl(x.issueQty,0)) CurStock
            from tbFacilityReceiptBatches rb 
            inner join tbfacilityreceiptitems i on rb.FACreceiptitemid=i.FACreceiptitemid
            inner join tbfacilityreceipts r on r.FACreceiptid=i.FACreceiptid
            left outer join 
            (
              select FacilityID, sum(nvl(a.IssueQty,0)) issueQty,0 AbsRQty, a.Inwno 
              from tbfacilityoutwards a 
              inner join tbfacilityissueitems tbi on tbi.issueitemid=a.issueitemid
              inner join tbfacilityissues tb on tb.issueid=tbi.issueid
              where tb.FacilityID= :usrFacilityID
              group by a.Inwno,FacilityID
            ) x on x.inwno=rb.inwno and x.FacilityID=r.FacilityID
            where (rb.ExpDate>=SysDate or nvl(rb.ExpDate,SysDate)>=SysDate) and r.status='C' 
            and r.FacilityID= :usrFacilityID
            group by i.itemid having sum(nvl(rb.AbsRqty,0))-sum(nvl(x.issueQty,0))>0
          ) cr on cr.itemid=Formate.ItemID 
          left outer join v_itemrate vr on vr.itemid=Formate.itemid 
          order by Formate.mcid, Formate.itemcode
      `;

      const result = await db.execute(dmeQuery, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result.rows || [];
      return rows.map((r, idx) => ({
        slNo: idx + 1,
        itemCode: r.ITEMCODE || r.itemcode || '-',
        itemName: r.ITEMNAME || r.itemname || '-',
        formulation: r.FORMULATION || r.formulation || '-',
        strength: r.STRENGTH || r.strength || '-',
        groupName: r.GROUPNAME || r.groupname || '-',
        edl: r.EDL || r.edl || '-',
        cosumptionFrom1Apr25: r.COSUMPTION_FROM_1APR_26 !== undefined ? r.COSUMPTION_FROM_1APR_26 : (r.COSUMPTION_FROM_1APR_25 !== undefined ? r.COSUMPTION_FROM_1APR_25 : 0),
        cosumptionFrom1Apr26: r.COSUMPTION_FROM_1APR_26 !== undefined ? r.COSUMPTION_FROM_1APR_26 : 0,
        currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : (r.CurStock !== undefined ? r.CurStock : 0),
        indent2627: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : (r.INDENT_26_27 !== undefined ? r.INDENT_26_27 : 0),
        indent2728: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : 0,
        rate: r.RATE !== undefined ? r.RATE : 0,
        packagingUnit: r.PACKAGINGUNIT !== undefined ? r.PACKAGINGUNIT : 1,
        categoryName: r.CATEGORYNAME || r.categoryname || '-',
        edlType: r.EDLTYPE || r.edltype || r.EDLType || 'EDL'
      }));
    }

    let categoryClause = "mt.categoryid in (52,53,54,55)";
    if (inputCatId !== 0) {
      categoryClause = `mt.categoryid in (${inputCatId})`;
    }

    const query = `
      SELECT 
        0 AS SlNo,
        Formate.itemcode,
        SUBSTR(Formate.itemname, 1, 100) AS itemname,
        Formate.Formulation,
        SUBSTR(Formate.Strength, 1, 100) AS Strength,
        Formate.GroupName,
        Formate.edl,
        NVL(iss.FacIssueqty, 0) AS Issued_From_WH_01_Apr_26_to_31st_Oct_26,
        0 AS Actual_Consumption_From_01_April_26_to_31st_Oct_26,
        0 AS Estimated_Consumption_For_One_Year_From_01_April_26_to_31st_March_27,
        NVL(cr.CurStock, 0) AS Current_Stock,
        0 AS ANNUAL_INDENT_27_28,
        NVL(vr.singlerate, 0) AS Rate,
        Formate.categoryname,
        Formate.EDLType
      FROM
      (
        SELECT 
            0 AS SlNo,
            m.itemcode,
            m.ItemID,
            CASE 
                WHEN LENGTH(m.itemname) > 100 THEN SUBSTR(m.itemname, 0, 100)
                ELSE itemname 
            END AS itemname,
            t.itemtypename AS Formulation,
            CASE 
                WHEN LENGTH(m.strength1) > 100 THEN SUBSTR(m.strength1, 0, 100) 
                ELSE m.strength1 
            END AS Strength,
            g.groupname AS GroupName,
            e.edl,
            0 AS COSUMPTION_From_1APR_24,
            0 AS Current_Stock,
            0 AS INDENT_25_26,
            m.isedl2021,
            mt.categoryname,
            CASE 
                WHEN isedl2021 = 'Y' THEN 'Yes' 
                ELSE 'No' 
            END AS EDL2021,
            CASE 
                WHEN EDL2025 = 'Y' THEN 'Yes' 
                ELSE 'No' 
            END AS EDL2025,
            CASE 
                WHEN (edl2025flag = 'COMMON' OR edl2025flag = 'DHS') 
                THEN 'Yes' 
                ELSE 'No' 
            END AS IsIPHS,
            CASE 
                WHEN EDL2025 = 'Y' 
                 AND (edl2025flag = 'COMMON' OR edl2025flag = 'DHS') 
                THEN  'EDL' 
                ELSE case when mt.categoryid in (53,54,55) and m.isedl2021='Y' then 'EDL' else'Non EDL' 
            END end AS EDLType,
            mc.mcid
        FROM masitems m 
        INNER JOIN masitemai ai 
            ON ai.itemid = m.itemid 
           AND ai.ACCYRSETID = (
                SELECT accyrsetId + 1 
                FROM masaccyearsettings 
                WHERE SYSDATE BETWEEN startdate AND enddate
           )
        INNER JOIN masitemgroups g 
            ON m.groupid = g.groupid  
        INNER JOIN masitemcategories mt 
            ON mt.categoryid = m.categoryid 
        INNER JOIN masitemmaincategory mc 
            ON mc.MCID = mt.MCID
        INNER JOIN masedl e 
            ON e.edlcat = m.edlcat 
        INNER JOIN masitemtypes t 
            ON t.itemtypeid = m.itemtypeid
        WHERE ${categoryClause}
          AND m.isfreez_itpr IS NULL 
          AND m.edlcat <= (
                SELECT ft.edlindent 
                FROM masfacilities f 
                INNER JOIN masfacilitytypes ft 
                    ON ft.facilitytypeid = f.facilitytypeid 
                WHERE f.facilityid = :usrFacilityID
          ) 
      ) Formate

      LEFT OUTER JOIN v_itemrate vr 
        ON vr.itemid = Formate.itemid

      LEFT OUTER JOIN
      (
        SELECT 
            ii.itemid,
            SUM(tbo.issueqty) AS FacIssueqty 
        FROM tbfacilityissues i
        INNER JOIN tbfacilityissueitems ii 
            ON ii.issueid = i.issueid
        INNER JOIN tbfacilityoutwards tbo 
            ON tbo.issueitemid = ii.issueitemid
        INNER JOIN tbfacilityreceiptbatches rb 
            ON rb.inwno = tbo.inwno
        WHERE 1=1 
          AND i.status = 'C'
          AND i.facilityid = :usrFacilityID 
          AND i.issuedate BETWEEN (
                SELECT startdate 
                FROM masaccyearsettings 
                WHERE accyrsetId = (
                    SELECT accyrsetId 
                    FROM masaccyearsettings 
                    WHERE SYSDATE BETWEEN startdate AND enddate
                )
          ) 
          AND (
                SELECT enddate 
                FROM masaccyearsettings 
                WHERE accyrsetId = (
                    SELECT accyrsetId 
                    FROM masaccyearsettings 
                    WHERE SYSDATE BETWEEN startdate AND enddate
                )
          )
        GROUP BY ii.itemid
      ) iss 
        ON iss.itemid = Formate.ItemID

      LEFT OUTER JOIN
      (
        SELECT 
            itemid,
            SUM(ReadyForIssue) AS CurStock 
        FROM (
            SELECT 
                b.batchno,
                b.expdate, 
                b.inwno,
                t.facilityid, 
                i.itemid, 
                CASE 
                    WHEN b.qastatus = '1' 
                    THEN (NVL(b.absrqty, 0) - NVL(iq.issueqty, 0)) 
                END AS ReadyForIssue  
            FROM tbfacilityreceiptbatches b   
            INNER JOIN tbfacilityreceiptitems i 
                ON b.facreceiptitemid = i.facreceiptitemid 
            INNER JOIN tbfacilityreceipts t 
                ON t.facreceiptid = i.facreceiptid                  
            LEFT OUTER JOIN 
            (  
                SELECT  
                    fs.facilityid,
                    fsi.itemid,
                    ftbo.inwno,
                    SUM(NVL(ftbo.issueqty, 0)) AS issueqty   
                FROM tbfacilityissues fs 
                INNER JOIN tbfacilityissueitems fsi 
                    ON fsi.issueid = fs.issueid 
                INNER JOIN tbfacilityoutwards ftbo 
                    ON ftbo.issueitemid = fsi.issueitemid 
                WHERE fs.status = 'C'   
                  AND fs.facilityid = :usrFacilityID             
                GROUP BY 
                    fsi.itemid, 
                    fs.facilityid, 
                    ftbo.inwno                     
            ) iq 
                ON b.inwno = iq.inwno 
               AND iq.itemid = i.itemid 
               AND iq.facilityid = t.facilityid                 
            WHERE t.Status = 'C'  
              AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
              AND b.expdate > SYSDATE 
              AND t.facilityid = :usrFacilityID
        ) 
        GROUP BY itemid  
        HAVING SUM(ReadyForIssue) > 0
      ) cr 
        ON cr.itemid = Formate.ItemID

      ORDER BY 
        DECODE(Formate.isedl2021, 'Y', 1), 
        DECODE(
            Formate.categoryname, 
            'DRUGS', 1, 
            'CONSUMABLE AND SURGICAL', 2, 
            'SURGICALS AND SUTURES', 3
        ),
        Formate.groupname,
        Formate.itemname
    `;

    const result = await db.execute(query, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      groupName: r.GROUPNAME || r.groupname || '-',
      edl: r.EDL || r.edl || '-',
      issuedFromWh: r.ISSUED_FROM_WH_01_APR_26_TO_31ST_OCT_26 !== undefined ? r.ISSUED_FROM_WH_01_APR_26_TO_31ST_OCT_26 : (r.ISSUED_FROM_WH !== undefined ? r.ISSUED_FROM_WH : 0),
      actualConsumption: r.ACTUAL_CONSUMPTION_FROM_01_APRIL_26_TO_31ST_OCT_26 !== undefined ? r.ACTUAL_CONSUMPTION_FROM_01_APRIL_26_TO_31ST_OCT_26 : 0,
      estimatedConsumption: r.ESTIMATED_CONSUMPTION_FOR_ONE_YEAR_FROM_01_APRIL_26_TO_31ST_MARCH_27 !== undefined ? r.ESTIMATED_CONSUMPTION_FOR_ONE_YEAR_FROM_01_APRIL_26_TO_31ST_MARCH_27 : 0,
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      annualIndent2728: r.ANNUAL_INDENT_27_28 !== undefined ? r.ANNUAL_INDENT_27_28 : 0,
      annualIndent2627: r.ANNUAL_INDENT_27_28 !== undefined ? r.ANNUAL_INDENT_27_28 : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      edlType: (String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'YES' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'Y' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'EDL') ? 'EDL' : 'Non EDL'
    }));
  } catch (error) {
    console.error('Error fetching Download AI Format Data:', error);
    throw error;
  }
}

// Fetch Indent Categories (AYUSH / Medical categories)
async function getIndentCategories(usrFacilityID) {
  try {
    const query = `
      SELECT
        sc.subcatid AS subcatid,
        c.categoryid AS categoryid,
        sc.catname || ' (' || c.categoryname || ')' AS categoryname
      FROM masitemcategories c
      INNER JOIN MasSubItemCategory sc
        ON sc.categoryid = c.categoryid
      WHERE c.categoryid IN (61, 59, 60, 58, 54)
        AND sc.subcatid NOT IN (
          SELECT CASE
                   WHEN AYFACTYPEID IN (13, 11) THEN 0
                   ELSE 7
                 END
          FROM masfacilities
          WHERE facilityid = :usrFacilityID
        )
      ORDER BY sc.subcatid
    `;

    const result = await db.execute(
      query,
      { usrFacilityID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return (result.rows || []).map(r => ({
      subcatId: r.SUBCATID,
      categoryId: r.CATEGORYID,
      categoryName: r.CATEGORYNAME
    }));
  } catch (error) {
    console.error('Error fetching Indent Categories:', error);
    throw error;
  }
}

// Get Financial Years for Upload & Forward Annual Indent
async function getUploadForwardFinYears() {
  try {
    const query = `
      select accyrsetid, accyear,
             case when sysdate between startdate and enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings 
      where accyrsetid > 537 
      order by accyrsetid desc
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching Upload Forward Fin Years:', error);
    throw error;
  }
}

// Fetch Upload & Forward Annual Indent List (AnualindentMain.aspx)
async function getUploadForwardList(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const query = `
      select null SlNo, a.DispatchNo, to_char(a.DispatchDate,'dd-mm-yyyy') DispatchDate, a.indentid NOCID, 
             a.indentno NOCNumber, to_char(a.indentdate,'dd-mm-yyyy') NOCDATE, 
             CASE a.Status   
               WHEN 'I' THEN 'Incomplete'  
               WHEN 'S' THEN 'Sent for Approval'  
               WHEN 'C' THEN 'Completed'  
               WHEN 'D' THEN 'Deleted' 
               ELSE 'Completed'
             end status, 
             c.AccYear, a.facilityID, 
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
               mc.categoryname,
               (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
               'General'
             ) categoryname 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
      where a.nonedlindenttype is null and a.isreagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId 
      Order by a.indentdate desc
    `;

    const result = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    let isDh = false;
    try {
      const facCheckRes = await db.execute(
        `select f.facilityname, ft.facilitytypecode, ft.facilitytypedesc 
         from masfacilities f 
         left outer join masfacilitytypes ft on f.facilitytypeid = ft.facilitytypeid 
         where f.facilityid = :facId`,
        { facId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (facCheckRes.rows && facCheckRes.rows.length > 0) {
        const fRow = facCheckRes.rows[0];
        const fCode = String(fRow.FACILITYTYPECODE || fRow.facilitytypecode || '').toUpperCase();
        const fDesc = String(fRow.FACILITYTYPEDESC || fRow.facilitytypedesc || '').toUpperCase();
        const fName = String(fRow.FACILITYNAME || fRow.facilityname || '').toUpperCase();
        if (fCode === 'DH' || fCode.includes('DH') || fDesc.includes('DH') || fDesc.includes('DISTRICT HOSPITAL') || fName.startsWith('DH ') || fName.includes('DISTRICT HOSPITAL')) {
          isDh = true;
        }
      }
    } catch (e) {
      console.error('Error checking facility type for DH:', e);
    }

    const canAdd = isDh ? (rows.length === 0) : true;
    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      facilityId: r.FACILITYID || r.facilityId,
      categoryName: r.CATEGORYNAME || r.categoryName || 'General',
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd };
  } catch (error) {
    console.error('Error fetching Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Header info for Create/Edit Annual Indent (AnualItemIndent.aspx)
async function getCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const query = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid, 
               coalesce(
                 (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                 mc.categoryname,
                 (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
                 'General'
               ) categoryname 
        from masAnualIndent a
        left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
        where a.indentid = :indId
      `;
      const result = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (result.rows && result.rows.length > 0) {
        const r = result.rows[0];
        return {
          indentId: r.INDENTID || r.indentId,
          indentNo: r.INDENTNO || r.indentNo,
          indentDate: r.INDENTDATE || r.indentDate,
          status: r.STATUS || r.status,
          categoryId: r.AICATEGORYID || r.aiCategoryId || 0,
          categoryName: r.CATEGORYNAME || r.categoryName || 'General',
          exists: true
        };
      }
    }

    if (facId > 0 && fyId > 0) {
      const checkQuery = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid, 
               coalesce(
                 (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                 mc.categoryname,
                 (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
                 'General'
               ) categoryname 
        from masAnualIndent a
        left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
        where a.facilityid = :facId
          and a.accyrsetid = :fyId
          and a.NONEDLIndentType is null
          and a.isReagent is null
        order by a.indentid desc
      `;
      const checkResult = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (checkResult.rows && checkResult.rows.length > 0) {
        const r = checkResult.rows[0];
        return {
          indentId: r.INDENTID || r.indentId,
          indentNo: r.INDENTNO || r.indentNo,
          indentDate: r.INDENTDATE || r.indentDate,
          status: r.STATUS || r.status,
          categoryId: r.AICATEGORYID || r.aiCategoryId || 0,
          categoryName: r.CATEGORYNAME || r.categoryName || 'General',
          exists: true
        };
      }
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: 'System Generated',
      status: 'N',
      categoryId: 0,
      categoryName: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Create Indent Header:', error);
    throw error;
  }
}

// Fetch Items Grid & Summary info for Create/Edit Annual Indent
async function getCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 0;
    const indId = Number(indentId) || 0;

    let itemsQuery = `
      select 0 SlNo, a.ANUALINDENTID, a.itemid, g.groupname, nvl(a.consumption,0) as consumption,
             nvl(a.PROJECTEDCONSUMPTION,0) as PROJECTEDCONSUMPTION, nvl(a.consumption,0)+nvl(a.PROJECTEDCONSUMPTION,0) as TotalConsumption,
             a.currentstock, a.facilityindentqty, a.status flag, nvl(a.Rate,0) as Rate,
             a.facilityindentqty*nvl(a.Rate,0) as indAprVal,
             m.ItemCode, m.ItemName, m.Strength1, m.Unit, m.PackingQty, b.ItemTypeCode,
             b.itemtypename as formulation,
             e.edl,
             mt.categoryname,
             case 
                 when coalesce(f.facilitytypeid, 0) in (364, 378) then
                     case 
                         when m.EDL2025 = 'Y' 
                          and (m.edl2025flag = 'COMMON' or m.edl2025flag = 'CME' or m.edl2025flag = 'DME') 
                         then 'EDL' 
                         else 'Non EDL' 
                     end
                 else
                     case 
                         when m.EDL2025 = 'Y' 
                          and (m.edl2025flag = 'COMMON' or m.edl2025flag = 'DHS') 
                         then 'EDL' 
                         else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end 
                     end
             end as EDLType,
             case when m.isedl2021='Y' then 'Yes' else 'No' end as EDL2021,
             case when m.EDL2025='Y' then 'Yes' else 'No' end as EDL2025,
             case when (m.edl2025flag='Common' or m.edl2025flag='DHS') then 'Yes' else 'No' end as IsIPHS,
             a.ACTUALCONSUMPTION
      from masanualindent ma 
      inner join anualindent a on a.indentid=ma.indentid
      left outer join masfacilities f on f.facilityid = ma.facilityid
      inner join masitems m on a.itemid=m.itemid  
      left outer join masitemgroups g on g.groupid=m.groupid  
      inner join masitemcategories mt on mt.categoryid=m.categoryid 
      left outer Join masItemTypes b on (b.ItemTypeID = m.ItemTypeID)
      left outer join masedl e on e.edlcat = m.edlcat
      where ma.indentid = :indId 
        and nvl(a.facilityindentqty, 0) > 0
    `;
    const binds = { indId };
    if (facId > 0) {
      itemsQuery += ` and ma.facilityid = :facId`;
      binds.facId = facId;
    }
    if (fyId > 0) {
      itemsQuery += ` and ma.accyrsetid = :fyId`;
      binds.fyId = fyId;
    }
    itemsQuery += `
      order by 
        case 
          when (upper(mt.categoryname) like '%DRUG%' or mt.categoryname is null) and (
            case 
              when coalesce(f.facilitytypeid, 0) in (364, 378) then
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
              else
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                     else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
            end = 'EDL'
          ) then 1
          when (upper(mt.categoryname) like '%DRUG%' or mt.categoryname is null) then 2
          when (upper(mt.categoryname) like '%CONSUM%' or upper(mt.categoryname) like '%SURG%' or upper(mt.categoryname) like '%SUTUR%') and (
            case 
              when coalesce(f.facilitytypeid, 0) in (364, 378) then
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
              else
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                     else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
            end = 'EDL'
          ) then 3
          when (upper(mt.categoryname) like '%CONSUM%' or upper(mt.categoryname) like '%SURG%' or upper(mt.categoryname) like '%SUTUR%') then 4
          else 5
        end,
        nvl(g.groupname, 'ZZZ'),
        m.itemname
    `;

    const itemsRes = await db.execute(itemsQuery, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = itemsRes.rows || [];

    const items = rows.map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualIndentId,
      itemId: r.ITEMID || r.itemId,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      packingQty: r.PACKINGQTY || r.packingQty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemTypeCode || '-',
      groupName: r.GROUPNAME || r.groupName || '-',
      edl: r.EDL || r.edl || '-',
      categoryName: r.CATEGORYNAME || r.categoryName || 'DRUGS',
      edlType: (String(r.EDLTYPE || r.edlType || '').trim().toUpperCase().includes('NON')) ? 'Non EDL' : ((String(r.EDLTYPE || r.edlType || '').trim().toUpperCase() === 'EDL' || String(r.EDLTYPE || r.edlType || '').trim().toUpperCase() === 'YES' || String(r.EDLTYPE || r.edlType || '').trim().toUpperCase() === 'Y') ? 'EDL' : 'Non EDL'),
      consumption: r.CONSUMPTION || r.consumption || 0,
      actualConsumption: r.ACTUALCONSUMPTION || r.actualConsumption || 0,
      projectedConsumption: r.PROJECTEDCONSUMPTION || r.projectedConsumption || 0,
      totalConsumption: r.TOTALCONSUMPTION || r.totalConsumption || 0,
      currentStock: r.CURRENTSTOCK || r.currentStock || 0,
      facilityIndentQty: r.FACILITYINDENTQTY || r.facilityIndentQty || 0,
      rate: r.RATE || r.rate || 0,
      indAprVal: r.INDAPRVAL || r.indAprVal || 0,
      flag: r.FLAG || r.flag || 'I'
    }));

    const summaryQuery = `
      select a.indentid, count(distinct ai.itemid) cntIte,
             sum(nvl(ai.FACILITYINDENTQTY,0)*nvl(ai.Rate,0)) as totalValRs
      from masanualindent a 
      inner join anualindent ai on ai.indentid=a.indentid
      where a.indentid = :indId and nvl(ai.FACILITYINDENTQTY,0) > 0
      group by a.indentid
    `;
    const summaryRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = 0;
    let aproxIndentValue = '0.00';
    if (summaryRes.rows && summaryRes.rows.length > 0) {
      noOfItems = Number(summaryRes.rows[0].CNTITE || summaryRes.rows[0].cntIte || 0);
      const totalRs = Number(summaryRes.rows[0].TOTALVALRS || summaryRes.rows[0].totalValRs || 0);
      const crVal = totalRs / 10000000;
      if (crVal >= 0.01) {
        aproxIndentValue = crVal.toFixed(2);
      } else if (crVal > 0) {
        aproxIndentValue = crVal.toFixed(4);
      } else {
        aproxIndentValue = '0.00';
      }
    }

    return {
      items,
      noOfItems,
      aproxIndentValue
    };
  } catch (error) {
    console.error('Error fetching Create Indent Items:', error);
    throw error;
  }
}

// Update single item row in anualindent
async function updateCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate) {
  try {
    const query = `
      update anualindent 
      set consumption = :consumption,
          actualconsumption = :actualConsumption,
          projectedconsumption = :projectedConsumption,
          currentstock = :currentStock,
          facilityindentqty = :facilityIndentQty,
          rate = :rate
      where anualindentid = :anualIndentId
    `;
    await db.execute(query, {
      consumption: Number(consumption) || 0,
      actualConsumption: Number(actualConsumption) || 0,
      projectedConsumption: Number(projectedConsumption) || 0,
      currentStock: Number(currentStock) || 0,
      facilityIndentQty: Number(facilityIndentQty) || 0,
      rate: Number(rate) || 0,
      anualIndentId: Number(anualIndentId)
    }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error updating Create Indent Item:', error);
    throw error;
  }
}

// Delete single item row in anualindent
async function deleteCreateIndentItem(anualIndentId) {
  try {
    const query = `delete from anualindent where anualindentid = :anualIndentId`;
    await db.execute(query, { anualIndentId: Number(anualIndentId) }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting Create Indent Item:', error);
    throw error;
  }
}

// Generate Annual Indent Header (lbtnUpdateSOInfo_Click)
async function generateIndentHeader(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const catId = categoryId ? Number(categoryId) : null;

    const existingCheck = await db.execute(
      `select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate, a.status, a.AIcategoryid,
              coalesce(
                (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                mc.categoryname,
                'General'
              ) as categoryname
       from masAnualIndent a
       left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
       where a.facilityid = :facId
         and a.accyrsetid = :fyId
         and a.NONEDLIndentType is null
         and a.isReagent is null
       order by a.indentid desc`,
      { facId, fyId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (existingCheck.rows && existingCheck.rows.length > 0) {
      const r = existingCheck.rows[0];
      return {
        indentId: r.INDENTID || r.indentId,
        indentNo: r.INDENTNO || r.indentNo,
        indentDate: r.INDENTDATE || r.indentDate,
        status: r.STATUS || r.status || 'I',
        categoryId: r.AICATEGORYID || r.aiCategoryId || 0,
        categoryName: r.CATEGORYNAME || r.categoryName || 'General',
        exists: true
      };
    }

    const facTypeRes = await db.execute(
      `select facilitytypeid from masfacilities where facilityid = :facId`,
      { facId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const facTypeId = facTypeRes.rows && facTypeRes.rows[0] ? String(facTypeRes.rows[0].FACILITYTYPEID || facTypeRes.rows[0].facilitytypeid) : '';

    let supplierCode = 'AI';
    if (facTypeId === '364' || facTypeId === '378' || facTypeId === '368') {
      const aiTypeCheck = await db.execute(
        `select count(indentid) cnt from masanualindent where nonedlindenttype is null and isreagent is null and facilityid = :facId and accyrsetid = :fyId and status = 'C' and isrevise is null`,
        { facId, fyId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (aiTypeCheck.rows && aiTypeCheck.rows[0] && Number(aiTypeCheck.rows[0].CNT || aiTypeCheck.rows[0].cnt) > 0) {
        supplierCode = 'RI';
      }
    }

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '26-27') : '26-27';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/${supplierCode}${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    const isRevise = supplierCode === 'RI' ? 'Y' : null;
    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode, AIcategoryid, isrevise)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, :catId, :isRevise)
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode, catId, isRevise }, { autoCommit: true });

    let categoryName = '';
    if (catId) {
      const catQuery = `
        select coalesce(
          (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = :catId),
          (select categoryname from masitemcategories where categoryid = :catId),
          'General'
        ) as catname from dual
      `;
      const catRes = await db.execute(catQuery, { catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (catRes.rows && catRes.rows.length > 0) {
        categoryName = catRes.rows[0].CATNAME || catRes.rows[0].catname || '';
      }
    }

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      categoryId: catId,
      categoryName,
      exists: true
    };
  } catch (error) {
    console.error('Error generating Indent Header:', error);
    throw error;
  }
}

// Freeze / Finalize Indent (btnFreez_Click)
async function freezeIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);

    const q1 = `update masAnualIndent set status='C', indentdate=sysdate, entrydate=sysdate, freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Indent:', error);
    throw error;
  }
}

// Delete whole Annual Indent (btndelete_Click)
async function deleteIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Indent:', error);
    throw error;
  }
}

// Bulk Save/Insert/Update items from uploaded Excel into anualindent table
async function uploadExcelIndentItems(facilityId, finYearId, indentId, items) {
  let connection;
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!indId || indId === 0) {
      throw new Error('Invalid Indent ID for Excel Upload');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { count: 0 };
    }

    connection = await db.getConnection();

    try {
      await connection.execute(`alter session disable parallel dml`);
    } catch (e) {
      // ignore
    }

    const existingRes = await connection.execute(
      `select anualindentid, itemid, upper(itemcode) as itemcode from anualindent where indentid = :indId`,
      { indId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingByItemId = new Map();
    const existingByItemCode = new Map();
    for (const r of (existingRes.rows || [])) {
      const aid = r.ANUALINDENTID || r.anualindentid;
      if (r.ITEMID || r.itemid) existingByItemId.set(Number(r.ITEMID || r.itemid), aid);
      const ic = String(r.ITEMCODE || r.itemcode || '').trim().toUpperCase();
      if (ic) existingByItemCode.set(ic, aid);
    }

    const masRes = await connection.execute(
      `select upper(itemcode) as code, itemid, nvl(unitcount, 1) as unitcount from masitems`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const masMap = new Map();
    for (const r of (masRes.rows || [])) {
      const code = String(r.CODE || r.code || '').trim().toUpperCase();
      if (code) {
        masMap.set(code, {
          itemId: Number(r.ITEMID || r.itemid),
          unitCount: Number(r.UNITCOUNT || r.unitcount || 1)
        });
      }
    }

    const idRes = await connection.execute(
      `select nvl(max(anualindentid), 0) as maxid from anualindent`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let nextId = Number(idRes.rows && idRes.rows[0] ? (idRes.rows[0].MAXID || idRes.rows[0].maxid || 0) : 0) + 1;

    await connection.execute(
      `delete from anualindent where indentid = :indId and (facilityindentqty is null or facilityindentqty <= 0)`,
      { indId }
    );
    await connection.commit();

    let updatedCount = 0;
    const updateQuery = `
      update anualindent 
      set facilityindentqty = :qty,
          consumption = :cons,
          actualconsumption = :actCons,
          projectedconsumption = :projCons,
          currentstock = :stock,
          rate = :rate
      where anualindentid = :anualIndentId
    `;

    const insertQuery = `
      insert into anualindent 
      (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, facilityindentqty, consumption, actualconsumption, projectedconsumption, currentstock, rate, status, entrydate)
      values
      (:nextId, :indId, :facId, :itemId, :code, :fyId, :qty, :cons, :actCons, :projCons, :stock, :rate, 'I', sysdate)
    `;

    for (const item of items) {
      const code = String(item.itemCode || '').trim();
      if (!code) continue;

      const rawQty = Number(item.facilityIndentQty) || 0;
      if (rawQty <= 0) continue;

      const upperCode = code.toUpperCase();
      const masItem = masMap.get(upperCode);
      if (!masItem) continue;

      const itemId = masItem.itemId;
      const unitCount = masItem.unitCount;
      const rate = Number(item.rate) || 0;

      const cons = Number(
        item.consumption !== undefined && item.consumption !== null
          ? item.consumption
          : (item.cosumptionFrom1Apr26 !== undefined && item.cosumptionFrom1Apr26 !== null
              ? item.cosumptionFrom1Apr26
              : (item.COSUMPTION_From_1APR_26 !== undefined && item.COSUMPTION_From_1APR_26 !== null
                  ? item.COSUMPTION_From_1APR_26
                  : (item.cosumptionFrom1Apr25 !== undefined && item.cosumptionFrom1Apr25 !== null
                      ? item.cosumptionFrom1Apr25
                      : (item.whIssued !== undefined && item.whIssued !== null
                          ? item.whIssued
                          : (item.issuedFromWh !== undefined && item.issuedFromWh !== null ? item.issuedFromWh : 0)))))
      ) || 0;

      const actCons = Number(
        item.actualConsumption !== undefined && item.actualConsumption !== null
          ? item.actualConsumption
          : (item.actualconsumption !== undefined && item.actualconsumption !== null ? item.actualconsumption : 0)
      ) || 0;

      const projCons = Number(
        item.projectedConsumption !== undefined && item.projectedConsumption !== null
          ? item.projectedConsumption
          : (item.estimatedConsumption !== undefined && item.estimatedConsumption !== null
              ? item.estimatedConsumption
              : (item.estConsumption !== undefined && item.estConsumption !== null ? item.estConsumption : 0))
      ) || 0;

      const stock = Number(item.currentStock) || 0;

      let qty = rawQty;
      if (unitCount > 1) {
        const skuIndent = Math.floor(rawQty / unitCount);
        qty = skuIndent > 0 ? skuIndent * unitCount : rawQty;
      }

      const existingId = existingByItemId.get(itemId) || existingByItemCode.get(upperCode);
      if (existingId) {
        await connection.execute(updateQuery, { qty, cons, actCons, projCons, stock, rate, anualIndentId: existingId });
        updatedCount++;
      } else {
        const currentId = nextId++;
        await connection.execute(insertQuery, { nextId: currentId, indId, facId, itemId, code, fyId, qty, cons, actCons, projCons, stock, rate });
        existingByItemId.set(itemId, currentId);
        existingByItemCode.set(upperCode, currentId);
        updatedCount++;
      }
    }

    await connection.commit();
    return { count: updatedCount };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error in uploadExcelIndentItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

// Fetch items for Annual Indent PDF download
async function getIndentPdfItems(indentId) {
  try {
    const indId = Number(indentId) || 0;
    const query = `
      select 0 as SlNo,
             a.ANUALINDENTID,
             a.indentid,
             a.itemid,
             m.itemcode,
             m.itemname,
             m.strength1,
             m.unit,
             m.packingqty,
             b.itemtypecode,
             b.itemtypename as formulation,
             g.groupname,
             e.edl,
             mt.categoryname,
             case 
                 when coalesce(f.facilitytypeid, 0) in (364, 378) then
                     case 
                         when m.EDL2025 = 'Y' 
                          and (m.edl2025flag = 'COMMON' or m.edl2025flag = 'CME' or m.edl2025flag = 'DME') 
                         then 'EDL' 
                         else 'Non EDL' 
                     end
                 else
                     case 
                         when m.EDL2025 = 'Y' 
                          and (m.edl2025flag = 'COMMON' or m.edl2025flag = 'DHS') 
                         then 'EDL' 
                         else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end 
                     end
             end as edltype,
             nvl(a.consumption, 0) as consumption,
             nvl(a.actualconsumption, 0) as actualconsumption,
             nvl(a.projectedconsumption, 0) as projectedconsumption,
             nvl(a.currentstock, 0) as currentstock,
             nvl(a.facilityindentqty, 0) as facilityindentqty,
             nvl(a.rate, 0) as rate,
             round(nvl(a.facilityindentqty, 0) * nvl(a.rate, 0), 2) as indaprval,
             a.status as flag
      from anualindent a
      inner join masanualindent ma on ma.indentid = a.indentid
      left outer join masfacilities f on f.facilityid = ma.facilityid
      inner join masitems m on m.itemid = a.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemtypes b on b.itemtypeid = m.itemtypeid
      left outer join masitemcategories mt on mt.categoryid = m.categoryid
      left outer join masedl e on e.edlcat = m.edlcat
      where a.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
      order by 
        case 
          when (upper(mt.categoryname) like '%DRUG%' or mt.categoryname is null) and (
            case 
              when coalesce(f.facilitytypeid, 0) in (364, 378) then
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
              else
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                     else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
            end = 'EDL'
          ) then 1
          when (upper(mt.categoryname) like '%DRUG%' or mt.categoryname is null) then 2
          when (upper(mt.categoryname) like '%CONSUM%' or upper(mt.categoryname) like '%SURG%' or upper(mt.categoryname) like '%SUTUR%') and (
            case 
              when coalesce(f.facilitytypeid, 0) in (364, 378) then
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
              else
                case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                     else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
            end = 'EDL'
          ) then 3
          when (upper(mt.categoryname) like '%CONSUM%' or upper(mt.categoryname) like '%SURG%' or upper(mt.categoryname) like '%SUTUR%') then 4
          else 5
        end,
        nvl(g.groupname, 'ZZZ'),
        m.itemname
    `;

    const res = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      indentId: r.INDENTID || r.indentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '',
      itemName: r.ITEMNAME || r.itemname || '',
      strength: r.STRENGTH1 || r.strength1 || r.STRENGTH || r.strength || '',
      strength1: r.STRENGTH1 || r.strength1 || r.STRENGTH || r.strength || '',
      STRENGTH1: r.STRENGTH1 || r.strength1 || r.STRENGTH || r.strength || '',
      unit: r.UNIT || r.unit || 'NOS',
      packingQty: r.PACKINGQTY || r.packingqty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemtypecode || '',
      formulation: r.FORMULATION || r.formulation || '',
      groupName: r.GROUPNAME || r.groupname || '',
      edl: r.EDL || r.edl || '',
      categoryName: r.CATEGORYNAME || r.categoryname || '',
      edlType: r.EDLTYPE || r.edltype || 'EDL',
      consumption: Number(r.CONSUMPTION !== undefined ? r.CONSUMPTION : 0),
      actualConsumption: Number(r.ACTUALCONSUMPTION !== undefined ? r.ACTUALCONSUMPTION : 0),
      projectedConsumption: Number(r.PROJECTEDCONSUMPTION !== undefined ? r.PROJECTEDCONSUMPTION : 0),
      currentStock: Number(r.CURRENTSTOCK !== undefined ? r.CURRENTSTOCK : 0),
      facilityIndentQty: Number(r.FACILITYINDENTQTY !== undefined ? r.FACILITYINDENTQTY : 0),
      rate: Number(r.RATE !== undefined ? r.RATE : 0),
      indAprVal: Number(r.INDAPRVAL !== undefined ? r.INDAPRVAL : 0),
      flag: r.FLAG || r.flag || 'I'
    }));
  } catch (error) {
    console.error('Error fetching Indent PDF Items:', error);
    throw error;
  }
}

module.exports = {
  // Core Annual Indent functions
  getIndentItems,
  getIndentSummary,
  getFacilityDistributions,
  insertDistribution,
  updateDistribution,
  deleteDistribution,
  getDownloadAiFormatData,
  getIndentCategories,
  getUploadForwardFinYears,
  getUploadForwardList,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  generateIndentHeader,
  freezeIndent,
  deleteIndent,
  uploadExcelIndentItems,
  getIndentPdfItems,

  // Re-exported from DH model for backward compatibility (Image 1)
  getDhUploadForwardFinYears: dhAnnualIndentModel.getDhUploadForwardFinYears,
  getDhUploadForwardList: dhAnnualIndentModel.getDhUploadForwardList,
  getDhCreateIndentHeader: dhAnnualIndentModel.getDhCreateIndentHeader,
  generateDhIndentHeader: dhAnnualIndentModel.generateDhIndentHeader,
  getDhCreateIndentItems: dhAnnualIndentModel.getDhCreateIndentItems,
  updateDhCreateIndentItem: dhAnnualIndentModel.updateDhCreateIndentItem,
  deleteDhCreateIndentItem: dhAnnualIndentModel.deleteDhCreateIndentItem,
  uploadExcelDhIndentItems: dhAnnualIndentModel.uploadExcelDhIndentItems,
  freezeDhIndent: dhAnnualIndentModel.freezeDhIndent,
  deleteDhIndent: dhAnnualIndentModel.deleteDhIndent,
  getDhDownloadFormatData: dhAnnualIndentModel.getDhDownloadFormatData,
  getDhIndentPdfItems: dhAnnualIndentModel.getDhIndentPdfItems,

  // Re-exported from Non-EDL model for backward compatibility
  getDynamicIndentHeaders: nonEdlAnnualIndentModel.getDynamicIndentHeaders,
  getDownloadNonEdlFormatData: nonEdlAnnualIndentModel.getDownloadNonEdlFormatData,
  getNonEdlUploadForwardList: nonEdlAnnualIndentModel.getNonEdlUploadForwardList,
  getNonEdlCreateIndentHeader: nonEdlAnnualIndentModel.getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader: nonEdlAnnualIndentModel.generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems: nonEdlAnnualIndentModel.getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems: nonEdlAnnualIndentModel.uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent: nonEdlAnnualIndentModel.freezeNonEdlIndent,
  deleteNonEdlIndent: nonEdlAnnualIndentModel.deleteNonEdlIndent,
  getNonEdlCreateFinYears: nonEdlAnnualIndentModel.getNonEdlCreateFinYears,

  // Re-exported from Reagent Non-EDL model for backward compatibility
  getDownloadReagentNonEdlFormatData: reagentNonEdlIndentModel.getDownloadReagentNonEdlFormatData,
  getReagentUploadForwardList: reagentNonEdlIndentModel.getReagentUploadForwardList,
  getReagentCreateIndentHeader: reagentNonEdlIndentModel.getReagentCreateIndentHeader,
  generateReagentIndentHeader: reagentNonEdlIndentModel.generateReagentIndentHeader,
  getReagentCreateIndentItems: reagentNonEdlIndentModel.getReagentCreateIndentItems,
  uploadExcelReagentIndentItems: reagentNonEdlIndentModel.uploadExcelReagentIndentItems,
  freezeReagentIndent: reagentNonEdlIndentModel.freezeReagentIndent,
  deleteReagentIndent: reagentNonEdlIndentModel.deleteReagentIndent,
  getReagentCreateFinYears: reagentNonEdlIndentModel.getReagentCreateFinYears,

  // Re-exported from Ayush model for backward compatibility (Image 2)
  getAyushUploadForwardFinYears: ayushAnnualIndentModel.getAyushUploadForwardFinYears,
  getAyushCategories: ayushAnnualIndentModel.getAyushCategories,
  getAyushUploadForwardList: ayushAnnualIndentModel.getAyushUploadForwardList,
  getAyushDownloadFormatData: ayushAnnualIndentModel.getAyushDownloadFormatData,
  getAyushCreateIndentHeader: ayushAnnualIndentModel.getAyushCreateIndentHeader,
  generateAyushIndentHeader: ayushAnnualIndentModel.generateAyushIndentHeader,
  getAyushCreateIndentItems: ayushAnnualIndentModel.getAyushCreateIndentItems,
  updateAyushCreateIndentItem: ayushAnnualIndentModel.updateAyushCreateIndentItem,
  deleteAyushCreateIndentItem: ayushAnnualIndentModel.deleteAyushCreateIndentItem,
  uploadExcelAyushIndentItems: ayushAnnualIndentModel.uploadExcelAyushIndentItems,
  freezeAyushIndent: ayushAnnualIndentModel.freezeAyushIndent,
  deleteAyushIndent: ayushAnnualIndentModel.deleteAyushIndent,
  getAyushIndentPdfItems: ayushAnnualIndentModel.getAyushIndentPdfItems,
  getDaoForwardedList: ayushAnnualIndentModel.getDaoForwardedList,
  getDaoDetailItems: ayushAnnualIndentModel.getDaoDetailItems,
  getDaoApprovalList: ayushAnnualIndentModel.getDaoApprovalList,
  getDaoIndentItems: ayushAnnualIndentModel.getDaoIndentItems,
  approveDaoIndent: ayushAnnualIndentModel.approveDaoIndent,
  getDaoStatusReport: ayushAnnualIndentModel.getDaoStatusReport,
  getDaoItemWiseAi: ayushAnnualIndentModel.getDaoItemWiseAi,

  // Re-exported from Medical College AI model for backward compatibility
  getMcHospitalAiVsIssuance: medicalCollegeAiModel.getMcHospitalAiVsIssuance,
  getMedicalCollegeAiDropdowns: medicalCollegeAiModel.getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport: medicalCollegeAiModel.getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns: medicalCollegeAiModel.getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport: medicalCollegeAiModel.getMcAiVsIssuanceReport,

  // Re-exported from CHC Approval model
  getChcFinYears: chcAnnualIndentModel.getChcFinYears,
  getChcDrugs: chcAnnualIndentModel.getChcDrugs,
  getChcFacilityItems: chcAnnualIndentModel.getChcFacilityItems,
  approveChcItem: chcAnnualIndentModel.approveChcItem,
  approveChcBatchItems: chcAnnualIndentModel.approveChcBatchItems,
  getChcDispatchDetails: chcAnnualIndentModel.getChcDispatchDetails,
  saveChcDispatchDetails: chcAnnualIndentModel.saveChcDispatchDetails,
  freezeChcIndent: chcAnnualIndentModel.freezeChcIndent
};
