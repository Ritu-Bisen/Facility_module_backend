const db = require('../config/db');
const oracledb = require('oracledb');

// Financial Years for DH Upload & Forward Annual Indent
async function getDhUploadForwardFinYears() {
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
    console.error('Error fetching DH Upload Forward Fin Years:', error);
    throw error;
  }
}

// Fetch DH Upload & Forward Annual Indent List (AnualindentMain.aspx for DH)
async function getDhUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 22595;
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
             c.AccYear, a.facilityID, a.AccYrSetID,
             'General' as categoryname 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.nonedlindenttype is null and a.isreagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId 
        ${statusClause}
      Order by a.indentdate desc
    `;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // For DH (District Hospital), only 1 annual indent is allowed per financial year
    const canAdd = rows.length === 0;

    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      facilityId: r.FACILITYID || r.facilityId,
      categoryName: 'General',
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd };
  } catch (error) {
    console.error('Error fetching DH Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Header info for Create/Edit DH Annual Indent
async function getDhCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const query = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid,
               c.accyear, 'General' as categoryname
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
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
          categoryId: 0,
          categoryName: 'General',
          exists: true
        };
      }
    }

    if (facId > 0 && fyId > 0) {
      const checkQuery = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid,
               c.accyear, 'General' as categoryname
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.facilityid = :facId
          and a.accyrsetid = :fyId
          and a.nonedlindenttype is null
          and a.isreagent is null
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
          accYear: r.ACCYEAR || r.accYear || '',
          categoryId: 0,
          categoryName: 'General',
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
      categoryName: 'General',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching DH Create Indent Header:', error);
    throw error;
  }
}

// Generate DH Annual Indent Header
async function generateDhIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const existingCheck = await db.execute(
      `select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate, a.status, c.accyear
       from masAnualIndent a
       left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
       where a.facilityid = :facId
         and a.accyrsetid = :fyId
         and a.nonedlindenttype is null
         and a.isreagent is null
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
        accYear: r.ACCYEAR || r.accYear || '',
        categoryId: 0,
        categoryName: 'General',
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
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode)
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      categoryId: 0,
      categoryName: 'General',
      exists: true
    };
  } catch (error) {
    console.error('Error generating DH Indent Header:', error);
    throw error;
  }
}

// Fetch DH Indent Items
async function getDhCreateIndentItems(facilityId, finYearId, indentId) {
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
      categoryName: r.CATEGORYNAME || r.categoryName || 'DRUGS',
      edlType: (String(r.EDLTYPE || r.edlType || '').trim().toUpperCase().includes('NON')) ? 'Non EDL' : 'EDL',
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
    console.error('Error fetching DH Create Indent Items:', error);
    throw error;
  }
}

// Update single item row in DH indent
async function updateDhCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate) {
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
    console.error('Error updating DH Indent Item:', error);
    throw error;
  }
}

// Delete single item row in DH indent
async function deleteDhCreateIndentItem(anualIndentId) {
  try {
    const query = `delete from anualindent where anualindentid = :anualIndentId`;
    await db.execute(query, { anualIndentId: Number(anualIndentId) }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting DH Indent Item:', error);
    throw error;
  }
}

// Upload Excel for DH Indent Items
async function uploadExcelDhIndentItems(facilityId, finYearId, indentId, items) {
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

      const cons = Number(item.consumption ?? item.whIssued ?? item.issuedFromWh ?? 0) || 0;
      const actCons = Number(item.actualConsumption ?? item.actualconsumption ?? 0) || 0;
      const projCons = Number(item.projectedConsumption ?? item.estimatedConsumption ?? item.estConsumption ?? 0) || 0;
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
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error in uploadExcelDhIndentItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
}

// Download Format Data for DH (Image 1)
async function getDhDownloadFormatData(facilityId, categoryId, facilityTypeId) {
  try {
    const usrFacilityID = Number(facilityId) || 22595;
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
        currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
        indent2627: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : (r.INDENT_26_27 !== undefined ? r.INDENT_26_27 : 0),
        indent2728: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : 0,
        rate: r.RATE !== undefined ? r.RATE : 0,
        packagingUnit: r.PACKAGINGUNIT || r.packagingunit || 1,
        categoryName: r.CATEGORYNAME || r.categoryname || '-',
        edlType: r.EDLTYPE || r.edltype || 'EDL'
      }));
    }

    const dhQuery = `
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
             AND (m.edl2025flag = 'COMMON' OR m.edl2025flag = 'DHS') 
            THEN 'EDL' 
            ELSE 
               CASE 
                   WHEN mt.categoryid in (53,54,55) and m.isedl2021='Y' 
                   THEN 'EDL' 
                   ELSE 'Non EDL' 
               END 
        END AS EDLType  
        from masitems m inner join masitemgroups g on m.groupid=g.groupid  
        inner join masitemcategories mt on mt.categoryid=m.categoryid 
        inner join masitemmaincategory mc on mc.mcid=mt.mcid
        inner join masedl e on e.edlcat=m.edlcat 
        inner join masitemtypes t on t.itemtypeid=m.itemtypeid 
        where mt.categoryid in(52,53,54,55) and m.EDL2025='Y' and m.EDL2025FLAG in ('COMMON','DHS') and m.isfreez_itpr is null
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

    const result = await db.execute(dhQuery, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
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
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      indent2627: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : (r.INDENT_26_27 !== undefined ? r.INDENT_26_27 : 0),
      indent2728: r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      packagingUnit: r.PACKAGINGUNIT || r.packagingunit || 1,
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      edlType: r.EDLTYPE || r.edltype || 'EDL'
    }));
  } catch (error) {
    console.error('Error fetching DH Download Format Data:', error);
    throw error;
  }
}

// Fetch PDF Items for DH Indent
async function getDhIndentPdfItems(indentId) {
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
             'EDL' as edltype,
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
      strength1: r.STRENGTH1 || r.strength1 || '',
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
    console.error('Error fetching DH Indent PDF Items:', error);
    throw error;
  }
}

// Freeze DH Indent
async function freezeDhIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', indentdate=sysdate, entrydate=sysdate, freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing DH Indent:', error);
    throw error;
  }
}

// Delete DH Indent
async function deleteDhIndent(facilityId, finYearId, indentId) {
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
    console.error('Error deleting DH Indent:', error);
    throw error;
  }
}

module.exports = {
  getDhUploadForwardFinYears,
  getDhUploadForwardList,
  getDhCreateIndentHeader,
  generateDhIndentHeader,
  getDhCreateIndentItems,
  updateDhCreateIndentItem,
  deleteDhCreateIndentItem,
  uploadExcelDhIndentItems,
  freezeDhIndent,
  deleteDhIndent,
  getDhDownloadFormatData,
  getDhIndentPdfItems
};
