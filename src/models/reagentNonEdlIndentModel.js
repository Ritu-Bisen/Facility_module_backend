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

// Fetch Reagent Non-EDL Consumable and Kits Format Data
async function getDownloadReagentNonEdlFormatData(facilityId, facilityTypeId) {
  try {
    let facTypeId = facilityTypeId ? String(facilityTypeId).trim() : '';

    if (!facTypeId && facilityId) {
      try {
        const facRes = await db.execute(
          `SELECT FACILITYTYPEID FROM MASFACILITIES WHERE FACILITYID = :facilityId`,
          [facilityId],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (facRes.rows && facRes.rows.length > 0) {
          facTypeId = String(facRes.rows[0].FACILITYTYPEID || facRes.rows[0].facilitytypeid || '').trim();
        }
      } catch (err) {
        console.warn('Could not determine facility type from DB:', err.message);
      }
    }

    const { consumptionHeader, indentHeader } = getDynamicIndentHeaders();

    let query = '';
    if (facTypeId === '364' || facTypeId === '378') {
      query = `
        select 0 SlNo,
               m.itemcode,
               case when length(m.itemname) > 100 then substr(m.itemname, 1, 100) else m.itemname end itemname,
               t.itemtypename Formulation,
               case when length(m.strength1) > 100 then substr(m.strength1, 1, 100) else m.strength1 end Strength,
               0 ${consumptionHeader},
               0 Current_Stock,
               0 ${indentHeader},
               nvl(vr.singlerate, 0) as Rate
        from masitems m
        inner join masitemcategories mt on mt.categoryid = m.categoryid
        inner join masitemtypes t on t.itemtypeid = m.itemtypeid
        left outer join v_itemrate vr on vr.itemid = m.itemid
        where 1 = 1
          and m.categoryid in (62)
          and m.isfreez_itpr is null
          and (
            (case when coalesce(${facTypeId || 0}, 0) in (364, 378) then
               case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
             else
               case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                    else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
             end) = 'Non EDL'
          )
        order by m.itemcode
      `;
    } else {
      query = `
        select 0 SlNo,
               m.itemcode,
               case when length(m.itemname) > 100 then substr(m.itemname, 1, 100) else m.itemname end itemname,
               t.itemtypename Formulation,
               case when length(m.strength1) > 100 then substr(m.strength1, 1, 100) else m.strength1 end Strength,
               0 ${consumptionHeader},
               0 Current_Stock,
               0 ${indentHeader},
               nvl(vr.singlerate, 0) as Rate
        from masitems m
        inner join masitemcategories mt on mt.categoryid = m.categoryid
        inner join masitemtypes t on t.itemtypeid = m.itemtypeid
        left outer join v_itemrate vr on vr.itemid = m.itemid
        where 1 = 1
          and m.categoryid in (62)
          and m.isfreez_itpr is null
          and (
            (case when coalesce(${facTypeId || 0}, 0) in (364, 378) then
               case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'CME', 'DME')) then 'EDL' else 'Non EDL' end
             else
               case when m.EDL2025 = 'Y' and (m.edl2025flag in ('COMMON', 'DHS')) then 'EDL'
                    else case when mt.categoryid in (53, 54, 55) and m.isedl2021 = 'Y' then 'EDL' else 'Non EDL' end end
             end) = 'Non EDL'
          )
        order by m.itemcode
      `;
    }

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
      reagentIndent: r[indKey] !== undefined ? r[indKey] : 0,
      nonEdlIndent: r[indKey] !== undefined ? r[indKey] : 0,
      nonEdlIndent2627: r[indKey] !== undefined ? r[indKey] : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      consumptionHeader,
      indentHeader
    }));
  } catch (error) {
    console.error('Error fetching Download Reagent Non-EDL AI Format Data:', error);
    throw error;
  }
}

// Fetch Reagent Upload & Forward List (REAGENTAnualindentMain.aspx)
async function getReagentUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    let statusClause = '';
    if (status && status !== 'All') {
      statusClause = `and a.Status = '${status}'`;
    }

    const query = `
      select null as SlNo,
             a.DispatchNo,
             to_char(a.DispatchDate, 'dd-mm-yyyy') as DispatchDate,
             a.indentid as NOCID,
             a.indentno as NOCNumber,
             to_char(a.indentdate, 'dd-mm-yyyy') as NOCDATE,
             CASE a.Status
               WHEN 'I' THEN 'Incomplete'
               WHEN 'S' THEN 'Sent for Approval'
               WHEN 'C' THEN 'Completed'
               WHEN 'D' THEN 'Deleted'
               ELSE a.Status
             END as status,
             c.AccYear,
             a.facilityID,
             a.AccYrSetID
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.NONEDLIndentType = 'Y'
        and a.isReagent = 'Y'
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId
        ${statusClause}
      order by a.indentdate desc
    `;

    const result = await db.execute(query, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const list = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      dispatchNo: r.DISPATCHNO || r.dispatchno || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchdate || '-',
      nocId: r.NOCID || r.nocid || 0,
      indentId: r.NOCID || r.nocid || 0,
      nocNumber: r.NOCNUMBER || r.nocnumber || '-',
      nocDate: r.NOCDATE || r.nocdate || '-',
      status: r.STATUS || r.status || '-',
      accYear: r.ACCYEAR || r.accyear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      categoryName: 'REAGENT',
      facilityId: r.FACILITYID || r.facilityid
    }));

    const checkQuery = `
      select count(indentid) as cnt
      from masanualindent
      where NONEDLIndentType = 'Y'
        and isReagent = 'Y'
        and facilityid = :facId
        and accyrsetid = :fyId
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const cnt = checkRes.rows && checkRes.rows[0] ? Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) : 0;
    const canAdd = cnt === 0;

    return { list, canAdd };
  } catch (error) {
    console.error('Error in getReagentUploadForwardList:', error);
    throw error;
  }
}

// Fetch Reagent Create Indent Header
async function getReagentCreateIndentHeader(facilityId, finYearId, indentId) {
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
        and a.isReagent = 'Y'
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
    console.error('Error fetching Reagent Indent Header:', error);
    throw error;
  }
}

// Generate Reagent Indent Header
async function generateReagentIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const checkQuery = `
      select count(indentid) as cnt
      from masAnualIndent
      where NONEDLIndentType = 'Y' and isReagent = 'Y'
        and AccYrSetID = :fyId and FacilityId = :facId
    `;
    const checkRes = await db.execute(checkQuery, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) > 0) {
      return await getReagentCreateIndentHeader(facId, fyId, 0);
    }

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '26-27') : '26-27';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/RG${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType, isReagent)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y', 'Y')
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      exists: true
    };
  } catch (error) {
    console.error('Error generating Reagent Indent Header:', error);
    throw error;
  }
}

// Fetch Reagent Indent Items and Summary
async function getReagentCreateIndentItems(facilityId, finYearId, indentId) {
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
        and ma.isReagent = 'Y'
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
    console.error('Error in getReagentCreateIndentItems:', error);
    throw error;
  }
}

// Upload Excel Reagent Indent Items
async function uploadExcelReagentIndentItems(facilityId, finYearId, indentId, rows) {
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

    // 1. Pre-fetch existing rows in anualindent for this indent
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

    // 2. Pre-fetch all masitems
    const masRes = await connection.execute(
      `select upper(itemcode) as code, itemid from masitems`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const masMap = new Map();
    for (const r of (masRes.rows || [])) {
      const code = String(r.CODE || r.code || '').trim().toUpperCase();
      if (code) {
        masMap.set(code, Number(r.ITEMID || r.itemid));
      }
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
      (:nextId, :indId, :facId, :itemId, :code, :fyId, :cons, :stock, :qty, 'I', :rate, sysdate)
    `;
    const updateQuery = `
      update anualindent
      set consumption = :cons, currentstock = :stock, facilityindentqty = :qty, rate = :rate
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
      const itemId = masMap.get(upperCode);
      if (!itemId) continue;

      const existingId = existingByItemId.get(itemId) || existingByItemCode.get(upperCode);
      if (existingId) {
        await connection.execute(updateQuery, { cons, stock, qty, rate, anualIndentId: existingId });
        insertedCount++;
      } else {
        const currentId = nextId++;
        await connection.execute(insertQuery, { nextId: currentId, indId, facId, itemId, code, fyId, cons, stock, qty, rate });
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
    console.error('Error in uploadExcelReagentIndentItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

// Freeze Reagent Indent
async function freezeReagentIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', entrydate=sysdate, indentdate=sysdate, freezdatetime=sysdate where NONEDLIndentType='Y' and isReagent='Y' and indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C' where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Reagent Indent:', error);
    throw error;
  }
}

// Delete Reagent Indent
async function deleteReagentIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where NONEDLIndentType='Y' and isReagent='Y' and indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Reagent Indent:', error);
    throw error;
  }
}

// Fetch Financial Years for Reagent Create Page
async function getReagentCreateFinYears(facilityId, mode, indentId) {
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
            and a.isReagent = 'Y'
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
    console.error('Error fetching Reagent Create Fin Years:', error);
    throw error;
  }
}

module.exports = {
  getDynamicIndentHeaders,
  getDownloadReagentNonEdlFormatData,
  getReagentUploadForwardList,
  getReagentCreateIndentHeader,
  generateReagentIndentHeader,
  getReagentCreateIndentItems,
  uploadExcelReagentIndentItems,
  freezeReagentIndent,
  deleteReagentIndent,
  getReagentCreateFinYears
};
