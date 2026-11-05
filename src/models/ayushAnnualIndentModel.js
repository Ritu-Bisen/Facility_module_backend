const db = require('../config/db');
const oracledb = require('oracledb');

// ==========================================
// 1. AYUSH Upload & Forward Page (Image 2)
// ==========================================

// Fetch Financial Years for Ayush Upload & Forward
async function getAyushUploadForwardFinYears() {
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
    console.error('Error fetching Ayush Upload Forward Fin Years:', error);
    throw error;
  }
}

// Fetch Categories for Ayush Download Format & Create Indent
async function getAyushCategories(usrFacilityID) {
  try {
    const facId = Number(usrFacilityID) || 29609;
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
          WHERE facilityid = :facId
        )
      ORDER BY sc.subcatid
    `;

    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return (result.rows || []).map(r => ({
      subcatId: r.SUBCATID || r.subcatid,
      categoryId: r.CATEGORYID || r.categoryid,
      categoryName: r.CATEGORYNAME || r.categoryname
    }));
  } catch (error) {
    console.error('Error fetching Ayush Categories:', error);
    throw error;
  }
}

// Fetch Ayush Upload & Forward Indent List (AnualindentMain.aspx for AYUSH)
async function getAyushUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 29609;
    const fyId = Number(finYearId) || 547;

    let statusClause = '';
    const binds = { facId, fyId };
    if (status && status !== 'All') {
      statusClause = ' and a.Status = :status ';
      binds.status = status;
    }

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
             c.AccYear, a.facilityID, a.AccYrSetID, a.AIcategoryid,
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' 
                from massubitemcategory sub 
                inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid 
                where sub.subcatid = a.AIcategoryid),
               mc.categoryname,
               'AYUSH'
             ) categoryname 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
      where a.nonedlindenttype is null and a.isreagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId 
        ${statusClause}
      Order by a.indentdate desc
    `;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // AYUSH facilities can add indents per category
    const canAdd = true;

    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      facilityId: r.FACILITYID || r.facilityId,
      categoryName: r.CATEGORYNAME || r.categoryname || 'AYUSH',
      aiCategoryId: r.AICATEGORYID || r.aicategoryid || 0,
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd };
  } catch (error) {
    console.error('Error fetching Ayush Upload Forward Indent List:', error);
    throw error;
  }
}

// Ayush Download Excel Format Data (GetItemDetail in C#)
async function getAyushDownloadFormatData(facilityId, subCatId) {
  try {
    const usrFacilityID = Number(facilityId) || 29609;
    const factypeid = String(subCatId || '8').trim();
    const whereclause = factypeid === '8' ? '' : " and nvl(m.isedl2021,'N')='Y'";

    const query = `
      select 0 SlNo, m.itemcode,
             case when length(m.itemname) > 100 then substr(m.itemname, 0, 100) else itemname end itemname,
             t.itemtypename Formulation,
             case when length(m.strength1) > 100 then substr(m.strength1, 0, 100) else m.strength1 end Strength,
             nvl(m.unit, '-') as UNIT,
             e.edl,
             sc.catname || ' (' || mt.categoryname || ')' as categoryname,
             nvl(COSUMPTION_From_1APR_23, 0) as COSUMPTION_From_1APR_25,
             nvl(cr.CurStock, 0) as CurStock,
             0 INDENT_26_27,
             nvl(vr.rates, 0) as Rates
      from masitems m
      inner join masitemcategories mt on mt.categoryid = m.categoryid
      inner join masedl e on e.edlcat = m.edlcat
      inner join masitemtypes t on t.itemtypeid = m.itemtypeid
      inner join MasSubItemCategory sc on sc.subcatid = m.subcatid
      left outer join vlastrate vr on vr.itemid = m.itemid
      left outer join (
          select i.itemid, sum(nvl(rb.AbsRqty, 0)) - sum(nvl(x.issueQty, 0)) CurStock
          from tbFacilityReceiptBatches rb
          inner join tbfacilityreceiptitems i on rb.FACreceiptitemid = i.FACreceiptitemid
          inner join tbfacilityreceipts r on r.FACreceiptid = i.FACreceiptid
          left outer join (
              select FacilityID, sum(nvl(a.IssueQty, 0)) issueQty, 0 AbsRQty, a.Inwno
              from tbfacilityoutwards a
              inner join tbfacilityissueitems tbi on tbi.issueitemid = a.issueitemid
              inner join tbfacilityissues tb on tb.issueid = tbi.issueid
              where tb.FacilityID = :usrFacilityID
              group by a.Inwno, FacilityID
          ) x on x.inwno = rb.inwno and x.FacilityID = r.FacilityID
          where (rb.ExpDate >= SysDate or nvl(rb.ExpDate, SysDate) >= SysDate)
            and r.status = 'C' and r.FacilityID = :usrFacilityID
          group by i.itemid
          having sum(nvl(rb.AbsRqty, 0)) - sum(nvl(x.issueQty, 0)) > 0
      ) cr on cr.itemid = m.ItemID
      left outer join (
          select edlitemcode as itemcode, sum(iss_qty) COSUMPTION_From_1APR_23
          from (
              select tb.issueid, tbi.itemid, tbi.ISSUEITEMID, m.edlitemcode,
                     sum(tbo.issueqty) iss_qty, m.unitcount
              from tbfacilityissues tb
              inner join tbfacilityissueitems tbi on tbi.issueid = tb.issueid
              inner join tbfacilityoutwards tbo on tbo.ISSUEITEMID = tbi.ISSUEITEMID
              inner join tbfacilityreceiptbatches rb on rb.inwno = tbo.inwno
              inner join vmasitems m on m.itemid = tbi.itemid
              where tb.status = 'C'
                and tb.facilityid = :usrFacilityID
                and tb.issuedate between (select startdate from masaccyearsettings where accyrsetId = 545)
                                     and (select enddate from masaccyearsettings where accyrsetId = 545)
              group by tb.issueid, tbi.itemid, tbi.ISSUEITEMID, m.edlitemcode, m.unitcount
          ) i
          group by edlitemcode
      ) Consumption on Consumption.itemcode = m.itemcode
      where sc.subcatid in (${Number(factypeid) || 8})
        and m.isfreezed is null ${whereclause}
      order by m.ayushAIOrder
    `;

    const result = await db.execute(query, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      unit: r.UNIT || r.unit || '-',
      edl: r.EDL || r.edl || '-',
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      cosumptionFrom1Apr25: r.COSUMPTION_FROM_1APR_25 !== undefined ? r.COSUMPTION_FROM_1APR_25 : 0,
      curStock: r.CURSTOCK !== undefined ? r.CURSTOCK : 0,
      indent2627: r.INDENT_26_27 !== undefined ? r.INDENT_26_27 : 0,
      rates: r.RATES !== undefined ? r.RATES : 0,
      consumption: r.COSUMPTION_FROM_1APR_25 !== undefined ? r.COSUMPTION_FROM_1APR_25 : 0,
      currentStock: r.CURSTOCK !== undefined ? r.CURSTOCK : 0,
      rate: r.RATES !== undefined ? r.RATES : 0
    }));
  } catch (error) {
    console.error('Error fetching Ayush Download Format Data:', error);
    throw error;
  }
}

// Fetch Header info for Create/Edit Ayush Annual Indent
async function getAyushCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 29609;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const query = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid,
               c.accyear,
               coalesce(
                 (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                 mc.categoryname,
                 'General'
               ) categoryname 
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
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
          accYear: r.ACCYEAR || r.accYear || '',
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
      accYear: '',
      categoryId: 0,
      categoryName: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Ayush Create Indent Header:', error);
    throw error;
  }
}

// Generate Ayush Indent Header
async function generateAyushIndentHeader(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 29609;
    const fyId = Number(finYearId) || 547;
    const catId = Number(categoryId) || 0;

    if (!catId || catId === 0) {
      throw new Error('Please select an Annual Indent Category');
    }

    // Check if an indent for this facility, financial year, and category already exists
    const checkQuery = `
      select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid,
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
               (select categoryname from masitemcategories where categoryid = a.AIcategoryid),
               'AYUSH'
             ) as categoryname
      from masAnualIndent a
      where a.facilityid = :facId
        and a.accyrsetid = :fyId
        and a.AIcategoryid = :catId
        and a.status != 'D'
      order by a.indentid desc
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId, catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];
      const exStatus = existing.STATUS || existing.status;
      const exIndentNo = existing.INDENTNO || existing.indentno;
      if (exStatus === 'C') {
        throw new Error(`Indent ${exIndentNo} for this category has already been Completed / Freezed.`);
      }
      return {
        indentId: existing.INDENTID || existing.indentid,
        indentNo: exIndentNo,
        indentDate: existing.INDENTDATE || existing.indentdate,
        status: exStatus,
        categoryId: catId,
        categoryName: existing.CATEGORYNAME || existing.categoryname || 'AYUSH',
        exists: true
      };
    }

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '27-28') : '27-28';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/AI${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode, AIcategoryid)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, :catId)
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode, catId }, { autoCommit: true });

    let categoryName = '';
    if (catId) {
      const catQuery = `
        select coalesce(
          (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = :catId),
          (select categoryname from masitemcategories where categoryid = :catId),
          'AYUSH'
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
    console.error('Error generating Ayush Indent Header:', error);
    throw error;
  }
}

// Fetch Ayush Indent Items
async function getAyushCreateIndentItems(facilityId, finYearId, indentId) {
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
    itemsQuery += ` order by nvl(g.groupname, 'ZZZ'), m.itemname`;

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
      categoryName: r.CATEGORYNAME || r.categoryName || '',
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
      aproxIndentValue = crVal >= 0.01 ? crVal.toFixed(2) : (crVal > 0 ? crVal.toFixed(4) : '0.00');
    }

    return { items, noOfItems, aproxIndentValue };
  } catch (error) {
    console.error('Error fetching Ayush Create Indent Items:', error);
    throw error;
  }
}

// Update single item row in Ayush indent
async function updateAyushCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate) {
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
    console.error('Error updating Ayush Indent Item:', error);
    throw error;
  }
}

// Delete single item row in Ayush indent
async function deleteAyushCreateIndentItem(anualIndentId) {
  try {
    const query = `delete from anualindent where anualindentid = :anualIndentId`;
    await db.execute(query, { anualIndentId: Number(anualIndentId) }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting Ayush Indent Item:', error);
    throw error;
  }
}

// Upload Excel for Ayush Indent Items
async function uploadExcelAyushIndentItems(facilityId, finYearId, indentId, items) {
  let connection;
  try {
    const facId = Number(facilityId) || 29609;
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
    } catch (e) { }

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
      const code = String(item.itemCode || item.itemcode || '').trim();
      if (!code) continue;

      const rawQty = Number(item.facilityIndentQty ?? item.indent2627 ?? item.INDENT_26_27 ?? 0);
      if (rawQty <= 0) continue;

      const upperCode = code.toUpperCase();
      const masItem = masMap.get(upperCode);
      if (!masItem) continue;

      const itemId = masItem.itemId;
      const unitCount = masItem.unitCount;
      const rate = Number(item.rate || item.rates || 0);

      const cons = Number(
        item.consumption !== undefined && item.consumption !== null
          ? item.consumption
          : (item.cosumptionFrom1Apr26 !== undefined && item.cosumptionFrom1Apr26 !== null
              ? item.cosumptionFrom1Apr26
              : (item.COSUMPTION_From_1APR_26 !== undefined && item.COSUMPTION_From_1APR_26 !== null
                  ? item.COSUMPTION_From_1APR_26
                  : (item.COSUMPTION_FROM_1APR_26 !== undefined && item.COSUMPTION_FROM_1APR_26 !== null
                      ? item.COSUMPTION_FROM_1APR_26
                      : (item.cosumptionFrom1Apr25 !== undefined && item.cosumptionFrom1Apr25 !== null
                          ? item.cosumptionFrom1Apr25
                          : (item.COSUMPTION_FROM_1APR_25 !== undefined && item.COSUMPTION_FROM_1APR_25 !== null
                              ? item.COSUMPTION_FROM_1APR_25
                              : (item.cosumption ?? item.whIssued ?? 0))))))
      ) || 0;
      const actCons = Number(item.actualConsumption ?? 0);
      const projCons = Number(item.projectedConsumption ?? 0);
      const stock = Number(item.currentStock ?? item.curStock ?? item.CurStock ?? 0);

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
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error in uploadExcelAyushIndentItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
}

// Freeze Ayush Indent
async function freezeAyushIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', indentdate=sysdate, entrydate=sysdate, freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Ayush Indent:', error);
    throw error;
  }
}

// Delete Ayush Indent
async function deleteAyushIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 29609;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Ayush Indent:', error);
    throw error;
  }
}

// ==========================================
// 2. DAO (District AYUSH Officer) Functions
// ==========================================

async function getDaoForwardedList(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    let query = `
      SELECT sc.CATNAME, sc.SUBCATID,
             MAX(a.DISPATCHNO)                               AS DISPATCHNO,
             to_char(MAX(a.DISPATCHDATE), 'dd-mm-yyyy')     AS DISPATCHDATE,
             MAX(mf.DISTRICTID)                             AS DISTRICTID
      FROM masAnualIndent a
      INNER JOIN masFacilities mf ON mf.FACILITYID = a.FACILITYID
      INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = a.AICATEGORYID
      WHERE a.STATUS       = 'C'
        AND mf.ISACTIVE    = 1
        AND mf.FACILITYTYPEID = 371
        AND a.DISPATCHNO IS NOT NULL
        AND a.ACCYRSETID   = :fyId
        AND mf.AYFACTYPEID NOT IN (11, 12, 13, 14)
        AND mf.DISTRICTID IN (
          SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
        )
      GROUP BY sc.CATNAME, sc.SUBCATID
      ORDER BY sc.CATNAME
    `;

    let res;
    try {
      res = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    } catch (colErr) {
      console.warn('getDaoForwardedList: AYFACTYPEID column missing, using fallback query:', colErr.message);
      const fallbackQuery = `
        SELECT sc.CATNAME, sc.SUBCATID,
               MAX(a.DISPATCHNO)                               AS DISPATCHNO,
               to_char(MAX(a.DISPATCHDATE), 'dd-mm-yyyy')     AS DISPATCHDATE,
               MAX(mf.DISTRICTID)                             AS DISTRICTID
        FROM masAnualIndent a
        INNER JOIN masFacilities mf ON mf.FACILITYID = a.FACILITYID
        INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = a.AICATEGORYID
        WHERE a.STATUS       = 'C'
          AND mf.ISACTIVE    = 1
          AND mf.FACILITYTYPEID = 371
          AND a.DISPATCHNO IS NOT NULL
          AND a.ACCYRSETID   = :fyId
          AND mf.DISTRICTID IN (
            SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
          )
        GROUP BY sc.CATNAME, sc.SUBCATID
        ORDER BY sc.CATNAME
      `;
      res = await db.execute(fallbackQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    }

    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      catName: r.CATNAME || r.catname || '',
      subCatId: r.SUBCATID || r.subcatid,
      dispatchNo: r.DISPATCHNO || r.dispatchno || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchdate || '-',
      districtId: r.DISTRICTID || r.districtid
    }));
  } catch (error) {
    console.error('Error fetching DAO forwarded list:', error);
    throw error;
  }
}

async function getDaoDetailItems(facilityId, subCatId, finYearId) {
  try {
    const facId = Number(facilityId) || 0;
    const subId = Number(subCatId) || 0;
    const fyId = Number(finYearId) || 547;

    const query = `
      SELECT m.ITEMCODE, m.ITEMNAME, m.STRENGTH1, m.UNIT,
             sc.CATNAME || ' (' || c.CATEGORYNAME || ')' AS CATEGORYNAME,
             NVL(agg.FACILITYINDENTQTY, 0) AS FACILITYINDENTQTY,
             NVL(agg.CMHOAPPROVEDQTY, 0) AS DAOAPPROVEDQTY,
             NVL(agg.AYUSHAPRQTY, 0) AS AYUSHAPRQTY
      FROM masItems m
      INNER JOIN masItemCategories c ON c.CATEGORYID = m.CATEGORYID
      INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = m.SUBCATID
      INNER JOIN (
        SELECT x.ITEMID,
               SUM(NVL(x.FACILITYINDENTQTY, 0)) AS FACILITYINDENTQTY,
               SUM(NVL(x.CMHOAPPROVEDQTY, 0)) AS CMHOAPPROVEDQTY,
               SUM(NVL(x.AYUSHAPRQTY, 0)) AS AYUSHAPRQTY
        FROM (
          SELECT ai.ITEMID, ai.FACILITYINDENTQTY, ai.CMHOAPPROVEDQTY, ai.AYUSHAPRQTY
          FROM masAnualIndent a
          INNER JOIN anualIndent ai ON ai.INDENTID = a.INDENTID
          INNER JOIN masFacilities f ON f.FACILITYID = a.FACILITYID
          WHERE f.ISACTIVE = 1
            AND f.FACILITYTYPEID = 371
            AND a.STATUS = 'C'
            AND f.DISTRICTID IN (
              SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
            )
            AND a.ACCYRSETID = :fyId
        ) x
        GROUP BY x.ITEMID
      ) agg ON agg.ITEMID = m.ITEMID
      WHERE m.SUBCATID = :subId
      ORDER BY sc.CATNAME, m.ITEMCODE
    `;

    const res = await db.execute(query, { facId, fyId, subId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || 0),
      daoApprovedQty: Number(r.DAOAPPROVEDQTY || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO detail items:', error);
    throw error;
  }
}

async function getDaoApprovalList(facilityId, finYearId, categoryId, statusFilter) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    let query = `
      SELECT a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') indentdate,
             a.facilityid, mf.facilityname, a.accyrsetid, c.accyear,
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' 
                from massubitemcategory sub 
                inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid 
                where sub.subcatid = a.aicategoryid),
               mc.categoryname,
               'General'
             ) categoryname,
             CASE 
               WHEN a.Status = 'C' AND EXISTS (SELECT 1 FROM anualindent ai WHERE ai.indentid = a.indentid AND ai.isayushapproved = 'Y') THEN 'Approved'
               WHEN a.Status = 'C' THEN 'Forwarded for Approval'
               WHEN a.Status = 'S' THEN 'Sent for Approval'
               WHEN a.Status = 'I' THEN 'Incomplete'
               ELSE 'Forwarded for Approval'
             END as status,
             (SELECT COUNT(*) FROM anualindent ai WHERE ai.indentid = a.indentid AND NVL(ai.facilityindentqty, 0) > 0) as totalitems,
             (SELECT NVL(SUM(ai.facilityindentqty), 0) FROM anualindent ai WHERE ai.indentid = a.indentid) as totalqty,
             (SELECT NVL(SUM(CASE WHEN ai.isayushapproved = 'Y' THEN ai.ayushaprqty ELSE ai.facilityindentqty END), 0) FROM anualindent ai WHERE ai.indentid = a.indentid) as totalapprovedqty
      FROM masAnualIndent a
      JOIN masfacilities mf ON a.facilityid = mf.facilityid
      JOIN masaccyearsettings c ON a.accyrsetid = c.accyrsetid
      LEFT OUTER JOIN masitemcategories mc ON mc.categoryid = a.aicategoryid
      WHERE (mf.districtid = (SELECT districtid FROM masfacilities WHERE facilityid = :facId) OR mf.facilitytypeid = 371)
        AND a.accyrsetid = :fyId
        AND a.Status IN ('C', 'S')
    `;

    const binds = { facId, fyId };

    if (categoryId && categoryId !== '0' && categoryId !== 'All') {
      query += ` AND a.aicategoryid = :catId `;
      binds.catId = Number(categoryId);
    }

    query += ` ORDER BY a.indentdate DESC, a.indentid DESC `;

    const res = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let rows = res.rows || [];

    if (statusFilter && statusFilter !== 'All') {
      rows = rows.filter(r => (r.STATUS || '').toLowerCase().includes(statusFilter.toLowerCase()));
    }

    return rows.map((r, idx) => ({
      slNo: idx + 1,
      indentId: r.INDENTID || r.indentid,
      indentNo: r.INDENTNO || r.indentno,
      indentDate: r.INDENTDATE || r.indentdate,
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      accYear: r.ACCYEAR || r.accyear,
      categoryName: r.CATEGORYNAME || r.categoryname || 'General',
      status: r.STATUS || r.status || 'Forwarded for Approval',
      totalItems: Number(r.TOTALITEMS || r.totalitems || 0),
      totalQty: Number(r.TOTALQTY || r.totalqty || 0),
      totalApprovedQty: Number(r.TOTALAPPROVEDQTY || r.totalapprovedqty || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO approval list:', error);
    throw error;
  }
}

async function getDaoIndentItems(indentId) {
  try {
    const indId = Number(indentId);
    const query = `
      SELECT ai.anualindentid, ai.indentid, ai.itemid,
             m.itemcode, m.itemname, m.strengths, m.unit,
             nvl(ai.facilityindentqty, 0) as facilityindentqty,
             nvl(ai.currentstock, 0) as currentstock,
             nvl(ai.consumption, 0) as consumption,
             nvl(ai.ayushaprqty, ai.facilityindentqty) as ayushaprqty,
             nvl(ai.isayushapproved, 'N') as isayushapproved
      FROM anualindent ai
      JOIN masitems m ON ai.itemid = m.itemid
      WHERE ai.indentid = :indId
        AND nvl(ai.facilityindentqty, 0) > 0
      ORDER BY m.itemname
    `;

    const res = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      indentId: r.INDENTID || r.indentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strengths: r.STRENGTHS || r.strengths || '-',
      unit: r.UNIT || r.unit || 'NOS',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || 0),
      currentStock: Number(r.CURRENTSTOCK || 0),
      consumption: Number(r.CONSUMPTION || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY !== null && r.AYUSHAPRQTY !== undefined ? r.AYUSHAPRQTY : r.FACILITYINDENTQTY || 0),
      isAyushApproved: r.ISAYUSHAPPROVED || r.isayushapproved || 'N'
    }));
  } catch (error) {
    console.error('Error fetching DAO indent items:', error);
    throw error;
  }
}

async function approveDaoIndent(indentId, userId, items) {
  let connection;
  try {
    connection = await db.getConnection();
    const indId = Number(indentId);
    const uId = Number(userId) || null;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemAiId = Number(item.anualIndentId);
        const aprQty = Number(item.ayushAprQty !== undefined ? item.ayushAprQty : item.facilityIndentQty);
        await connection.execute(
          `UPDATE anualindent 
           SET ayushaprqty = :aprQty, isayushapproved = 'Y', lastupdateddt = SYSDATE 
           WHERE anualindentid = :itemAiId AND indentid = :indId`,
          { aprQty, itemAiId, indId }
        );
      }
    } else {
      await connection.execute(
        `UPDATE anualindent 
         SET ayushaprqty = nvl(ayushaprqty, facilityindentqty), isayushapproved = 'Y', lastupdateddt = SYSDATE 
         WHERE indentid = :indId`,
        { indId }
      );
    }

    await connection.execute(
      `UPDATE masAnualIndent 
       SET approveddt = SYSDATE, approvedby = :uId, status = 'C' 
       WHERE indentid = :indId`,
      { uId, indId }
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error approving DAO indent:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

async function getDaoStatusReport(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const catId = Number(categoryId) || 1;

    let wherecluase = '';
    const catStr = String(catId);

    if (catStr === '3' || catStr === '4') {
      wherecluase += ' and fta.FACTYPEID in (2,5,8)';
    } else if (catStr === '5' || catStr === '6') {
      wherecluase += ' and fta.FACTYPEID in (2,9,4)';
    } else if (catStr === '7') {
      wherecluase += ' and fta.FACTYPEID in (11,13)';
    } else if (catStr === '8') {
      wherecluase += ' and fta.FACTYPEID not in (1,11,13,14) ';
    } else if (catStr === '1' || catStr === '2') {
      wherecluase += ' and fta.FACTYPEID not in (5,13,8,9,14,4,11)';
    }

    const query = `
      select 0 as SlNo, d.districtname, fta.FACTYPENAME, fm.facilityid, fm.facilityname,
             case 
               when ai.status = 'C' then 'Annual Indent Uploaded and Forwarded' 
               when ai.status = 'I' then 'Annual Indent Uploaded but not Forwarded' 
               else 'Indent Not Uploaded' 
             end as status,
             ai.AIcategoryid,
             coalesce(
               sc.catname || ' (' || mc.categoryname || ')', 
               (select sc2.catname || ' (' || mc2.categoryname || ')' from MasSubItemCategory sc2 inner join masitemcategories mc2 on mc2.categoryid=sc2.categoryid where sc2.subcatid=:catId),
               ''
             ) as categoryname
      from masfacilities fm  
      left outer join (
        select facilityid, status, AIcategoryid 
        from masanualindent
        where accyrsetid = :fyId and AIcategoryid = :catId
      ) ai on ai.facilityid = fm.facilityid  
      inner join masdistricts d on d.districtid = fm.districtid
      inner join masfacilitytypes ft on ft.facilitytypeid = fm.facilitytypeid  
      inner join masfacilitytypeayush fta on fta.FACTYPEID = fm.AYFACTYPEID 
      left outer join MasSubItemCategory sc on sc.SUBCATID = ai.AIcategoryid 
      left outer join masitemcategories mc on mc.categoryid = sc.categoryid
      where 1=1 
        and fm.isactive = 1 
        ${wherecluase}
        and fm.facilitytypeid = 371 
        and fm.districtid in (select districtid from masfacilities where facilityid = :facId) 
        and fm.facilityid not in (:facId) 
      order by ft.orderdp
    `;

    const res = await db.execute(query, { facId, fyId, catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = res.rows || [];

    return rows.map((r, idx) => ({
      slNo: idx + 1,
      districtName: r.DISTRICTNAME || r.districtname || '',
      factypeName: r.FACTYPENAME || r.factypename || '',
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      status: r.STATUS || r.status || 'Indent Not Uploaded',
      aiCategoryId: r.AICATEGORYID || r.aicategoryid || catId,
      categoryName: r.CATEGORYNAME || r.categoryname || ''
    }));
  } catch (error) {
    console.error('Error fetching DAO status report:', error);
    throw error;
  }
}

async function getDaoItemWiseAi(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const subCatId = Number(categoryId) || 0;

    let strFilter = '';
    const binds = { facId, fyId };

    if (subCatId > 0) {
      strFilter = ` and m.subcatid = :subCatId `;
      binds.subCatId = subCatId;
    }

    const query = `
      select m.itemid, m.itemcode, m.itemname, m.strength1, m.unit,
             sc.catname || ' (' || c.categoryname || ')' as categoryname,
             nvl(ai.facilityindentqty, 0) as facilityindentqty,
             nvl(ai.cmhoapprovedqty, 0) as daoapprovedqty,
             nvl(ai.ayushaprqty, 0) as ayushaprqty
      from masitems m 
      inner join masitemcategories c on c.categoryid = m.categoryid
      inner join MasSubItemCategory sc on sc.subcatid = m.subcatid
      inner join (
        select x.itemid,
               sum(nvl(facilityindentqty, 0)) as facilityindentqty,
               sum(nvl(cmhoapprovedqty, 0)) as cmhoapprovedqty,
               sum(nvl(ayushaprqty, 0)) as ayushaprqty
        from (
          select a.indentid, a.indentno, a.indentdate, a.facilityid, f.facilityname,
                 ai.itemid, ai.anualindentid, ai.facilityindentqty, ai.cmhoapprovedqty, ai.ayushaprqty
          from masanualindent a
          inner join anualindent ai on ai.indentid = a.indentid
          inner join masfacilities f on f.facilityid = a.facilityid
          where f.isactive = 1
            and f.facilitytypeid = 371
            and f.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
            and a.status = 'C'
            and a.accyrsetid = :fyId
        ) x group by x.itemid
      ) ai on ai.itemid = m.itemid
      where 1=1 ${strFilter}
      order by sc.catname, m.itemcode
    `;

    const res = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || 'NOS',
      categoryName: r.CATEGORYNAME || r.categoryname || '',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || r.facilityindentqty || 0),
      daoApprovedQty: Number(r.DAOAPPROVEDQTY || r.daoapprovedqty || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY || r.ayushaprqty || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO item wise AI details:', error);
    throw error;
  }
}

// Fetch Ayush Indent PDF Items
async function getAyushIndentPdfItems(indentId) {
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
             'AYUSH' as edltype,
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
      inner join masitems m on m.itemid = a.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemtypes b on b.itemtypeid = m.itemtypeid
      left outer join masitemcategories mt on mt.categoryid = m.categoryid
      left outer join masedl e on e.edlcat = m.edlcat
      where a.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
      order by nvl(g.groupname, 'ZZZ'), m.itemname
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
      edlType: r.EDLTYPE || r.edltype || 'AYUSH',
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
    console.error('Error fetching AYUSH Indent PDF Items:', error);
    throw error;
  }
}

module.exports = {
  // AYUSH Upload & Forward Page (Image 2)
  getAyushUploadForwardFinYears,
  getAyushCategories,
  getAyushUploadForwardList,
  getAyushDownloadFormatData,
  getAyushCreateIndentHeader,
  generateAyushIndentHeader,
  getAyushCreateIndentItems,
  updateAyushCreateIndentItem,
  deleteAyushCreateIndentItem,
  uploadExcelAyushIndentItems,
  freezeAyushIndent,
  deleteAyushIndent,
  getAyushIndentPdfItems,

  // DAO Functions
  getDaoForwardedList,
  getDaoDetailItems,
  getDaoApprovalList,
  getDaoIndentItems,
  approveDaoIndent,
  getDaoStatusReport,
  getDaoItemWiseAi
};
