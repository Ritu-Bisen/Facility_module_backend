const db = require('../config/db');
const oracledb = require('oracledb');

function getDynamicIndentHeaders() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currYr = String(currentYear).slice(-2);
  const nextYr1 = String(currentYear + 1).slice(-2);
  const nextYr2 = String(currentYear + 2).slice(-2);

  return {
    currYr,
    nextYr1,
    nextYr2,
    consumptionHeader: `COSUMPTION_From_1APR_${currYr}`,
    indentHeader: `Non_EDL_INDENT_${nextYr1}_${nextYr2}`
  };
}

// Fetch Non-EDL Annual Indent Format Data
async function getDownloadNonEdlFormatData(facilityId, categoryId) {
  try {
    const { consumptionHeader, indentHeader } = getDynamicIndentHeaders();
    const query = `
      SELECT 
        0 AS SlNo,
        m.itemcode,
        CASE 
          WHEN LENGTH(m.itemname) > 100 THEN SUBSTR(m.itemname, 1, 100) 
          ELSE m.itemname 
        END AS itemname,
        t.itemtypename AS Formulation,
        CASE 
          WHEN LENGTH(m.strength1) > 100 THEN SUBSTR(m.strength1, 1, 100) 
          ELSE m.strength1 
        END AS Strength, 
        0 AS ${consumptionHeader},
        0 AS Current_Stock,
        0 AS ${indentHeader},
        NVL(vr.singlerate, 0) AS Rate,
        NVL(m.unitcount, 1) AS PACKAGINGUNIT,
        mt.categoryname
      FROM masitems m 
      INNER JOIN masitemcategories mt ON mt.categoryid = m.categoryid    
      INNER JOIN masitemmaincategory mc ON mc.mcid = mt.mcid  
      LEFT OUTER JOIN masitemtypes t ON t.itemtypeid = m.itemtypeid 
      LEFT OUTER JOIN v_itemrate vr ON vr.itemid = m.itemid
      WHERE 1=1 
        AND (NVL(m.EDL2025, 'N') = 'N' OR m.EDL2025FLAG = 'DHS') 
        AND m.isfreez_itpr IS NULL
        AND m.categoryid IN (52, 53, 54, 55, 56, 63, 65, 66)  
        AND m.isfreez_itpr IS NULL  
      ORDER BY mc.mcid, m.itemcode
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    const consKey = consumptionHeader.toUpperCase();
    const indKey = indentHeader.toUpperCase();
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      consumptionFrom1Apr: r[consKey] !== undefined ? r[consKey] : 0,
      consumptionFrom1Apr25: r[consKey] !== undefined ? r[consKey] : 0,
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      nonEdlIndent: r[indKey] !== undefined ? r[indKey] : 0,
      nonEdlIndent2627: r[indKey] !== undefined ? r[indKey] : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      packagingUnit: r.PACKAGINGUNIT !== undefined ? r.PACKAGINGUNIT : 1,
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      consumptionHeader,
      indentHeader
    }));
  } catch (error) {
    console.error('Error fetching Download Non-EDL AI Format Data:', error);
    throw error;
  }
}

// Fetch Non-EDL Upload & Forward List
async function getNonEdlUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 546;

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
             c.AccYear, a.facilityID, a.AccYrSetID 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.NONEDLIndentType = 'Y' 
        and a.isReagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId
        ${statusClause}
      Order by a.indentdate
    `;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // Check if an indent exists for this facility & fin year
    const cntQuery = `
      select count(indentid) as CNT 
      from masanualindent 
      where NONEDLIndentType = 'Y' 
        and isReagent is null 
        and facilityid = :facId 
        and accyrsetid = :fyId
    `;
    const cntRes = await db.execute(cntQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const count = Number(cntRes.rows?.[0]?.CNT || 0);
    const canAdd = count === 0;

    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      categoryName: 'NON-EDL',
      facilityId: r.FACILITYID || r.facilityId,
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd, count };
  } catch (error) {
    console.error('Error fetching Non-EDL Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Header info for Non-EDL Indent
async function getNonEdlCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const q = `
        select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
               a.status, a.accyrsetid, c.accyear
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          indentId: row.INDENTID || row.indentid,
          indentNo: row.INDENTNO || row.indentno,
          indentDate: row.INDENTDATE || row.indentdate,
          status: row.STATUS || row.status || 'I',
          accYear: row.ACCYEAR || row.accyear || '',
          exists: true
        };
      }
    }

    const checkQuery = `
      select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
             a.status, a.accyrsetid, c.accyear
      from masAnualIndent a
      left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
      where a.NONEDLIndentType = 'Y'
        and a.isReagent is null
        and a.facilityid = :facId
        and a.accyrsetid = :fyId
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && checkRes.rows.length > 0) {
      const row = checkRes.rows[0];
      return {
        indentId: row.INDENTID || row.indentid,
        indentNo: row.INDENTNO || row.indentno,
        indentDate: row.INDENTDATE || row.indentdate,
        status: row.STATUS || row.status || 'I',
        accYear: row.ACCYEAR || row.accyear || '',
        exists: true
      };
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: 'System Generated',
      status: 'N',
      accYear: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Non-EDL Indent Header:', error);
    throw error;
  }
}

// Generate Non-EDL Indent Header
async function generateNonEdlIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const checkQuery = `
      select count(indentid) as cnt
      from masAnualIndent
      where NONEDLIndentType = 'Y' and isReagent is null
        and AccYrSetID = :fyId and FacilityId = :facId
    `;
    const checkRes = await db.execute(checkQuery, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const isDup = checkRes.rows && Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) > 0;

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '27-28') : '27-28';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/NE${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    if (isDup) {
      const insertQuery = `
        insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType, isrevise)
        values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y', 'Y')
      `;
      await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });
    } else {
      const insertQuery = `
        insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType)
        values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y')
      `;
      await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });
    }

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      exists: true
    };
  } catch (error) {
    console.error('Error generating Non-EDL Indent Header:', error);
    throw error;
  }
}

// Fetch Non-EDL Indent Items and Summary
async function getNonEdlCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    const query = `
      select 0 as SlNo,
             a.ANUALINDENTID,
             a.itemid,
             g.groupname,
             a.consumption,
             a.currentstock,
             a.facilityindentqty,
             a.status as flag,
             nvl(a.Rate, 0) as Rate,
             a.facilityindentqty * nvl(a.Rate, 0) as indAprVal,
             m.ItemCode,
             m.ItemName,
             m.Strength1,
             m.Unit,
             m.PackingQty,
             b.ItemTypeCode
      from masanualindent ma
      inner join anualindent a on a.indentid = ma.indentid
      left outer join masfacilities f on f.facilityid = ma.facilityid
      inner join masitems m on a.itemid = m.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemcategories mt on mt.categoryid = m.categoryid
      left outer join masItemTypes b on b.ItemTypeID = m.ItemTypeID
      where ma.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
        and ma.NONEDLIndentType = 'Y'
        and ma.isReagent is null
        and m.categoryid in (52, 53, 54, 55, 56, 63, 65, 66)
        and ma.facilityid = :facId
        and ma.accyrsetid = :fyId
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

    const result = await db.execute(query, { indId, facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const items = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '',
      itemName: r.ITEMNAME || r.itemname || '',
      strength1: r.STRENGTH1 || r.strength1 || '',
      unit: r.UNIT || r.unit || 'NOS',
      packingQty: r.PACKINGQTY || r.packingqty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemtypecode || '',
      groupName: r.GROUPNAME || r.groupname || '',
      consumption: Number(r.CONSUMPTION !== undefined ? r.CONSUMPTION : 0),
      currentStock: Number(r.CURRENTSTOCK !== undefined ? r.CURRENTSTOCK : 0),
      facilityIndentQty: Number(r.FACILITYINDENTQTY !== undefined ? r.FACILITYINDENTQTY : 0),
      rate: Number(r.RATE !== undefined ? r.RATE : 0),
      indAprVal: Number(r.INDAPRVAL !== undefined ? r.INDAPRVAL : 0),
      flag: r.FLAG || r.flag || 'I'
    }));

    const summaryQuery = `
      select a.indentid,
             count(distinct ai.itemid) as cntIte,
             round(sum(nvl(ai.FACILITYINDENTQTY, 0) * nvl(ai.Rate, 0)) / 10000000, 2) as indVal
      from masanualindent a
      inner join anualindent ai on ai.indentid = a.indentid
      where a.indentid = :indId
        and nvl(ai.FACILITYINDENTQTY, 0) > 0
      group by a.indentid
    `;
    const sumRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = items.length;
    let aproxIndentValue = '0.00';
    if (sumRes.rows && sumRes.rows.length > 0) {
      noOfItems = Number(sumRes.rows[0].CNTITE || sumRes.rows[0].cntite || items.length);
      aproxIndentValue = Number(sumRes.rows[0].INDVAL || sumRes.rows[0].indval || 0).toFixed(2);
    }

    return { items, noOfItems, aproxIndentValue };
  } catch (error) {
    console.error('Error in getNonEdlCreateIndentItems:', error);
    throw error;
  }
}

// Upload Excel Non-EDL Indent Items
async function uploadExcelNonEdlIndentItems(facilityId, finYearId, indentId, rows) {
  let connection;
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!indId || indId <= 0) {
      throw new Error('Please Generate Indent Number First then Upload File.');
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { count: 0 };
    }

    connection = await db.getConnection();

    try {
      await connection.execute(`alter session disable parallel dml`);
    } catch (e) {
      // ignore
    }

    // 1. Pre-fetch valid Non-EDL items from masItems
    const masRes = await connection.execute(
      `select upper(itemcode) as code, itemid, nvl(unitcount, 1) as unitcount 
       from masItems 
       where ISFREEZ_ITPR is null 
         and (nvl(EDL2025FLAG,'N')='N' or EDL2025FLAG='DHS')
         and categoryid not in (62,59,61,58,60)`,
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

    // 2. Pre-fetch existing rows in anualindent for this indent
    const existingRes = await connection.execute(
      `select anualindentid, itemid, upper(itemcode) as itemcode from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`,
      { indId, facId, fyId },
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

    // 3. Pre-fetch max(anualindentid)
    const idRes = await connection.execute(
      `select nvl(max(anualindentid), 0) as maxid from anualindent`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let nextId = Number(idRes.rows && idRes.rows[0] ? (idRes.rows[0].MAXID || idRes.rows[0].maxid || 0) : 0) + 1;

    let insertedCount = 0;
    const insertQuery = `
      insert into anualindent
      (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, consumption, currentstock, facilityindentqty, status, Rate, entrydate)
      values
      (:nextId, :indId, :facId, :itemId, :code, :fyId, :cons, :stock, :finQty, 'I', :rate, sysdate)
    `;
    const updateQuery = `
      update anualindent
      set consumption = :cons, currentstock = :stock, facilityindentqty = :finQty, rate = :rate
      where anualindentid = :anualIndentId
    `;

    for (const r of rows) {
      const code = String(r.itemcode || r.itemCode || '').trim();
      if (!code) continue;

      const rawQty = r.facilityIndentQty ?? r.nonEdlIndent ?? r.nonEdlIndent2728 ?? r.nonEdlIndent2627 ?? r.Non_EDL_INDENT_27_28 ?? r.Non_EDL_INDENT_26_27 ?? 0;
      const qty = Number(rawQty) || 0;
      const rate = Number(r.rate || r.Rate || 0);

      if (qty > 0) {
        if (rate <= 0) {
          throw new Error(`Rate should not be empty for item: ${code}`);
        }
      } else {
        continue;
      }

      const rawCons = r.consumption ?? r.consumptionFrom1Apr ?? r.consumptionFrom1Apr25 ?? r.COSUMPTION_From_1APR_26 ?? r.COSUMPTION_From_1APR_25 ?? 0;
      const cons = Number(rawCons) || 0;
      const stock = Number(r.currentStock !== undefined ? r.currentStock : (r.Current_Stock || 0));

      const upperCode = code.toUpperCase();
      const masItem = masMap.get(upperCode);
      if (!masItem) continue;

      const itemId = masItem.itemId;
      const unitCount = masItem.unitCount;

      let finQty = qty;
      if (unitCount > 1) {
        const skuIndent = Math.floor(qty / unitCount);
        finQty = skuIndent > 0 ? skuIndent * unitCount : qty;
      }

      const existingId = existingByItemId.get(itemId) || existingByItemCode.get(upperCode);
      if (existingId) {
        await connection.execute(updateQuery, { cons, stock, finQty, rate, anualIndentId: existingId });
        insertedCount++;
      } else {
        const currentId = nextId++;
        await connection.execute(insertQuery, { nextId: currentId, indId, facId, itemId, code, fyId, cons, stock, finQty, rate });
        existingByItemId.set(itemId, currentId);
        existingByItemCode.set(upperCode, currentId);
        insertedCount++;
      }
    }

    await connection.commit();
    return { count: insertedCount };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error in uploadExcelNonEdlIndentItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

// Freeze Non-EDL Indent
async function freezeNonEdlIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', entrydate=sysdate, indentdate=sysdate, freezdatetime=sysdate where NONEDLIndentType='Y' and isReagent is null and indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C' where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Non-EDL Indent:', error);
    throw error;
  }
}

// Delete Non-EDL Indent
async function deleteNonEdlIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where NONEDLIndentType='Y' and isReagent is null and indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Non-EDL Indent:', error);
    throw error;
  }
}

// Fetch Financial Years for Non-EDL Create Page
async function getNonEdlCreateFinYears(facilityId, mode, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const indId = Number(indentId) || 0;

    if (mode === 'Edit' && indId > 0) {
      const q = `
        select c.accyrsetid, c.accyear,
               case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
        from masAnualIndent a
        inner join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          accYrSetId: r.ACCYRSETID || r.accyrsetid,
          accYear: r.ACCYEAR || r.accyear,
          isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
        }));
      }
    }

    const query = `
      select c.accyrsetid, c.accyear,
             case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings c
      where c.accyrsetid > 546
        and c.accyrsetid not in (
          select distinct a.accyrsetid
          from masAnualIndent a
          where a.NONEDLIndentType = 'Y'
            and a.isReagent is null
            and a.facilityid = :facId
        )
      order by c.accyrsetid desc
    `;
    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching Non-EDL Create Fin Years:', error);
    throw error;
  }
}

module.exports = {
  getDynamicIndentHeaders,
  getDownloadNonEdlFormatData,
  getNonEdlUploadForwardList,
  getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent,
  deleteNonEdlIndent,
  getNonEdlCreateFinYears
};
