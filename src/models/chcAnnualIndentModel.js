const db = require('../config/db');
const oracledb = require('oracledb');

// Fetch financial years for CHC Approval
async function getChcFinYears() {
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
      accYrSetId: r.ACCYRSETID || r.accyrsetid,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching CHC Fin Years:', error);
    throw error;
  }
} 

// Bind Drugs dropdown (BindItems)
async function getChcDrugs(usrFacilityID, finYearId) {
  try {
    const facId = Number(usrFacilityID) || 0;
    const fyId = Number(finYearId) || 0;

    const query = `
      select distinct (m.itemcode || ' - ' || m.itemname) as itemname, m.itemid
      from Anualindent a 
      inner join masAnualindent ma on ma.indentid = a.indentid
      inner join masfacilities mf on mf.facilityid = a.facilityid 
      inner join masitems m on m.itemid = a.itemid 
      where a.status = 'C' 
        and m.categoryid not in (62) 
        and ma.chcapprove is null 
        and mf.chcfacilityid = :facId
        and a.accyrsetid = :fyId
      order by itemname
    `;

    const result = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      itemId: r.ITEMID || r.itemid,
      itemName: r.ITEMNAME || r.itemname
    }));
  } catch (error) {
    console.error('Error fetching CHC Drugs dropdown:', error);
    throw error;
  }
}

// Populate Data grid for selected drug
async function getChcFacilityItems(usrFacilityID, finYearId, itemId) {
  try {
    const facId = Number(usrFacilityID) || 0;
    const fyId = Number(finYearId) || 0;
    const itmId = Number(itemId) || 0;

    const query = `
      select 0 as SlNo, nvl(a.ANUALINDENTID, 0) as anualindentid, mf.facilityid, mf.facilityname, 
             m.itemcode, m.itemid, m.itemname,
             sum(nvl(a.BMOApprovedQty, 0)) as bmoapprovedqty1,
             case when sum(nvl(a.BMOApprovedQty, 0)) = 0 then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.BMOApprovedQty, 0)) end as bmoapprovedqtyold,
             case when sum(a.BMOApprovedQty) is null then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.BMOApprovedQty, 0)) end as bmoapprovedqty,
             sum(nvl(a.facilityindentqty, 0)) as anlqty,
             sum(nvl(a.consumption, 0)) as consumption,
             sum(nvl(a.currentstock, 0)) as currentstock,
             max(a.isapprovedchc) as isapprovedchc
      from Anualindent a 
      inner join masAnualindent ma on ma.indentid = a.indentid 
      inner join masfacilities mf on mf.facilityid = a.facilityid 
      inner join masitems m on m.itemid = a.itemid 
      where a.status = 'C' 
        and ma.chcapprove is null 
        and mf.chcfacilityid = :facId 
        and m.itemid = :itmId 
        and a.accyrsetid = :fyId 
      group by mf.facilityid, mf.facilityname, m.itemcode, m.itemname, m.itemid, a.ANUALINDENTID
      order by mf.facilityname
    `;

    const result = await db.execute(query, { facId, itmId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      itemCode: r.ITEMCODE || r.itemcode,
      itemId: r.ITEMID || r.itemid,
      itemName: r.ITEMNAME || r.itemname,
      consumption: Number(r.CONSUMPTION || r.consumption || 0),
      currentStock: Number(r.CURRENTSTOCK || r.currentstock || 0),
      anlQty: Number(r.ANLQTY || r.anlqty || 0),
      bmoApprovedQty: Number(r.BMOAPPROVEDQTY !== undefined ? r.BMOAPPROVEDQTY : (r.bmoapprovedqty !== undefined ? r.bmoapprovedqty : (r.anlqty || 0))),
      isApprovedChc: r.ISAPPROVEDCHC || r.isapprovedchc || null,
      isApproved: (r.ISAPPROVEDCHC === 'Y' || r.isapprovedchc === 'Y' || Number(r.BMOAPPROVEDQTY || r.bmoapprovedqty || 0) > 0)
    }));
  } catch (error) {
    console.error('Error fetching CHC Facility Items:', error);
    throw error;
  }
}

// Approve Single Item (imgBtnAdd_Click)
async function approveChcItem(anualIndentId, itemId, facilityId, finYearId, approveQty) {
  try {
    const aid = Number(anualIndentId);
    const itmId = Number(itemId);
    const facId = Number(facilityId);
    const fyId = Number(finYearId);
    const qty = Number(approveQty) || 0;

    const query = `
      update Anualindent 
      set BMOApprovedQty = :qty, isapprovedchc = 'Y'  
      where ANUALINDENTID = :aid 
        and itemid = :itmId 
        and facilityid = :facId 
        and accyrsetid = :fyId
    `;

    await db.execute(query, { qty, aid, itmId, facId, fyId }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error approving CHC Item:', error);
    throw error;
  }
}

// Batch Approve multiple items
async function approveChcBatchItems(items, finYearId) {
  let connection;
  try {
    const fyId = Number(finYearId);
    if (!Array.isArray(items) || items.length === 0) return { updatedCount: 0 };

    connection = await db.getConnection();
    let updatedCount = 0;

    for (const item of items) {
      const aid = Number(item.anualIndentId);
      const itmId = Number(item.itemId);
      const facId = Number(item.facilityId);
      const qty = Number(item.approveQty !== undefined ? item.approveQty : item.bmoApprovedQty) || 0;

      const query = `
        update Anualindent 
        set BMOApprovedQty = :qty, isapprovedchc = 'Y'  
        where ANUALINDENTID = :aid 
          and itemid = :itmId 
          and facilityid = :facId 
          and accyrsetid = :fyId
      `;
      await connection.execute(query, { qty, aid, itmId, facId, fyId });
      updatedCount++;
    }

    await connection.commit();
    return { updatedCount };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('Error in approveChcBatchItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}

// Bind Dispatch Details (BindDispatchDedail)
async function getChcDispatchDetails(usrFacilityID, finYearId) {
  try {
    const facId = Number(usrFacilityID) || 0;
    const fyId = Number(finYearId) || 0;

    const query = `
      select dispatchno, to_char(dispatchdate, 'YYYY-MM-DD') as dispatchdate, chcapprove 
      from masanualindent  
      where accyrsetid = :fyId 
        and indentid in (
          select a.indentid 
          from masAnualindent a 
          inner join masfacilities mf on mf.facilityid = a.facilityid 
          where a.accyrsetid = :fyId and mf.chcfacilityid = :facId
        )
    `;

    const result = await db.execute(query, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      const r = result.rows[0];
      return {
        dispatchNo: r.DISPATCHNO || r.dispatchno || '',
        dispatchDate: r.DISPATCHDATE || r.dispatchdate || '',
        chcApprove: r.CHCAPPROVE || r.chcapprove || null,
        isCompleted: (r.CHCAPPROVE === 'C' || r.chcapprove === 'C')
      };
    }
    return {
      dispatchNo: '',
      dispatchDate: '',
      chcApprove: null,
      isCompleted: false
    };
  } catch (error) {
    console.error('Error fetching CHC Dispatch details:', error);
    throw error;
  }
}

// Save Dispatch Details (btnsave_Click)
async function saveChcDispatchDetails(usrFacilityID, finYearId, dispatchNo, dispatchDate) {
  try {
    const facId = Number(usrFacilityID) || 0;
    const fyId = Number(finYearId) || 0;
    const dispNo = String(dispatchNo || '').trim();
    const dispDt = String(dispatchDate || '').trim();

    const query = `
      update masAnualIndent  
      set dispatchno = :dispNo, 
          dispatchdate = case when :dispDt is not null then to_date(:dispDt, 'YYYY-MM-DD') else null end
      where accyrsetid = :fyId 
        and indentid in (
          select a.indentid 
          from masAnualindent a 
          inner join masfacilities mf on mf.facilityid = a.facilityid 
          where a.accyrsetid = :fyId and mf.chcfacilityid = :facId
        )
    `;

    await db.execute(query, { dispNo, dispDt: dispDt || null, fyId, facId }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error saving CHC Dispatch Details:', error);
    throw error;
  }
}

// Freeze / Complete Indent (btnComplete_Click)
async function freezeChcIndent(usrFacilityID, finYearId) {
  try {
    const facId = Number(usrFacilityID) || 0;
    const fyId = Number(finYearId) || 0;

    // 1. Validation 1: Getallapprove()
    // Checks if all active facilities mapped to this CHC have finalized annual indents
    const facSubmittedRes = await db.execute(
      `select count(distinct a.facilityid) as cnt
       from masAnualindent a 
       inner join masfacilities mf on mf.facilityid = a.facilityid
       where a.status = 'C' and mf.isactive = 1 and a.accyrsetid = :fyId and mf.chcfacilityid = :facId`,
      { fyId, facId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const submittedCount = Number(facSubmittedRes.rows?.[0]?.CNT || facSubmittedRes.rows?.[0]?.cnt || 0);

    const totalFacRes = await db.execute(
      `select count(facilityid) as cnt 
       from masfacilities 
       where isactive = 1 and chcfacilityid = :facId`,
      { facId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const totalFacilities = Number(totalFacRes.rows?.[0]?.CNT || totalFacRes.rows?.[0]?.cnt || 0);

    if (totalFacilities > submittedCount) {
      const notApprovedFacRes = await db.execute(
        `select facilityid, facilityname 
         from masfacilities 
         where isactive = 1 and chcfacilityid = :facId
           and facilityid not in (
             select a.facilityid from masAnualindent a 
             where a.status = 'C' and a.accyrsetid = :fyId
           )
         order by facilityname`,
        { facId, fyId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const pendingFacs = (notApprovedFacRes.rows || []).map(r => r.FACILITYNAME || r.facilityname);
      return {
        success: false,
        reason: 'FACILITIES_PENDING',
        message: 'Your facilities have not frozen annual indents: ' + pendingFacs.join(', '),
        pendingFacilities: pendingFacs
      };
    }

    // 2. Validation 2: GetallapprovedItem()
    // Checks if there are any unapproved items (isapprovedchc is null and facilityindentqty > 0)
    const notApprovedItemsRes = await db.execute(
      `select a.itemid, a.facilityid, mf.facilityname, a.itemcode 
       from Anualindent a 
       inner join masfacilities mf on mf.facilityid = a.facilityid 
       where mf.chcfacilityid = :facId 
         and a.status = 'C' 
         and mf.isactive = 1 
         and a.accyrsetid = :fyId 
         and a.facilityindentqty > 0 
         and a.isapprovedchc is null`,
      { facId, fyId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const pendingItems = notApprovedItemsRes.rows || [];
    if (pendingItems.length > 0) {
      const pendingList = pendingItems.map(r => `${r.FACILITYNAME || r.facilityname} (${r.ITEMCODE || r.itemcode})`);
      return {
        success: false,
        reason: 'ITEMS_PENDING',
        message: 'Please Approve All items Before Freezing: ' + pendingList.slice(0, 10).join(', ') + (pendingList.length > 10 ? ` and ${pendingList.length - 10} more` : ''),
        pendingItems: pendingList
      };
    }

    // 3. Freeze by setting chcapprove = 'C'
    const updateSql = `
      update masAnualindent 
      set chcapprove = 'C' 
      where accyrsetid = :fyId 
        and indentid in (
          select a.indentid 
          from masAnualindent a 
          inner join masfacilities mf on mf.facilityid = a.facilityid 
          where a.accyrsetid = :fyId and mf.chcfacilityid = :facId
        )
    `;

    await db.execute(updateSql, { fyId, facId }, { autoCommit: true });
    return {
      success: true,
      message: 'Approved & Freezed Successfully'
    };
  } catch (error) {
    console.error('Error freezing CHC Indent:', error);
    throw error;
  }
}

module.exports = {
  getChcFinYears,
  getChcDrugs,
  getChcFacilityItems,
  approveChcItem,
  approveChcBatchItems,
  getChcDispatchDetails,
  saveChcDispatchDetails,
  freezeChcIndent
};
