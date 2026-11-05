const db = require('../config/db');
const oracledb = require('oracledb');

/**
 * Get Financial Years for DAO Approval
 */
async function getDaoFinYears() {
  try {
    const query = `
      select accyrsetid, accyear,
             case when sysdate between startdate and enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings 
      where accyrsetid > 537 
      order by accyrsetid desc
    `;
    const res = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accyrsetid,
      accYear: r.ACCYEAR || r.accyear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching DAO Fin Years:', error);
    throw error;
  }
}

/**
 * Fill Category (FillCategory)
 * Select categories from MasSubItemCategory for AYUSH: categoryid in (61,59,60,58,54)
 */
async function getDaoCategories() {
  try {
    const strquery = `
      select sc.subcatid, c.categoryid, sc.catname || ' (' || categoryname || ')' as categoryname
      from masitemcategories c
      inner join MasSubItemCategory sc on sc.categoryid = c.categoryid
      where c.categoryid in (61, 59, 60, 58, 54) 
      order by sc.subcatid
    `;
    const res = await db.execute(strquery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map(r => ({
      subcatId: r.SUBCATID,
      categoryId: r.CATEGORYID,
      categoryName: r.CATEGORYNAME
    }));
  } catch (error) {
    console.error('Error fetching DAO Categories:', error);
    throw error;
  }
}

/**
 * Get Drugs for DAO approval dropdown (BindItems)
 */
async function getDaoDrugs(facilityId, finYearId, subcatId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const catId = Number(subcatId) || 0;

    let whereClause = '';
    const binds = { facId, fyId };
    if (catId > 0) {
      whereClause = ' and m.SUBCATID = :catId ';
      binds.catId = catId;
    }

    const strQuery = `
      select distinct (itemcode || '-' || itemname) as itemname, itemid from (
        select null SlNo, nvl(a.ANUALINDENTID, 0) ANUALINDENTID, mf.facilityid,
               mf.facilityname, m.itemcode, m.itemid as itemid, itemname, 
               sum(nvl(a.CMHOAPPROVEDQTY, 0)) BMOApprovedQty1,
               case when sum(nvl(a.CMHOAPPROVEDQTY, 0)) = '0' then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.CMHOAPPROVEDQTY, 0)) end BMOApprovedQtyold,
               case when sum(a.CMHOAPPROVEDQTY) is null then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.CMHOAPPROVEDQTY, 0)) end BMOApprovedQty, 
               sum(nvl(a.facilityindentqty, 0)) anlQty,
               sum(nvl(a.consumption, 0)) consumption,
               sum(nvl(a.currentstock, 0)) currentstock
        from Anualindent a 
        inner join masAnualindent ma on ma.indentid = a.indentid
        inner join masfacilities mf on mf.facilityid = a.facilityid 
        inner join masitems m on m.itemid = a.itemid 
        where a.status = 'C' 
          and m.categoryid not in (62) 
          and mf.facilitytypeid = 371 
          and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14)
          and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
          and a.accyrsetid = :fyId 
          ${whereClause}
        group by mf.facilityid, mf.facilityname, m.itemcode, itemname, m.itemid, a.ANUALINDENTID
      ) order by itemname
    `;

    const res = await db.execute(strQuery, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map(r => ({
      itemId: r.ITEMID,
      itemName: r.ITEMNAME
    }));
  } catch (error) {
    console.error('Error fetching DAO Drugs:', error);
    throw error;
  }
}

/**
 * Get Facility Indent Items for a selected Drug (PopulateData)
 */
async function getDaoFacilityItems(facilityId, finYearId, itemId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const itmId = Number(itemId) || 0;

    const strSQL = `
      select 0 SlNo, nvl(a.ANUALINDENTID, 0) ANUALINDENTID, mf.facilityid, mf.facilityname, 
             m.itemcode, m.itemid as itemid, itemname,
             sum(nvl(a.CMHOAPPROVEDQTY, 0)) BMOApprovedQty1,
             case when sum(nvl(a.CMHOAPPROVEDQTY, 0)) = '0' then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.CMHOAPPROVEDQTY, 0)) end BMOApprovedQtyold,
             case when sum(a.CMHOAPPROVEDQTY) is null then sum(nvl(a.facilityindentqty, 0)) else sum(nvl(a.CMHOAPPROVEDQTY, 0)) end BMOApprovedQty,
             sum(nvl(a.facilityindentqty, 0)) anlQty,
             sum(nvl(a.consumption, 0)) consumption,
             sum(nvl(a.currentstock, 0)) currentstock,
             max(nvl(a.CMHOAPRSTATUS, 'N')) as cmhoAprStatus
      from Anualindent a 
      inner join masAnualindent ma on ma.indentid = a.indentid 
      inner join masfacilities mf on mf.facilityid = a.facilityid 
      inner join masitems m on m.itemid = a.itemid 
      where a.status = 'C' 
        and mf.facilitytypeid = 371 
        and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14)
        and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
        and m.itemid = :itmId 
        and a.accyrsetid = :fyId  
      group by mf.facilityid, mf.facilityname, m.itemcode, itemname, m.itemid, a.ANUALINDENTID
      order by mf.facilityname
    `;

    const res = await db.execute(strSQL, { facId, fyId, itmId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => {
      const bmoApprovedQty = Number(r.BMOAPPROVEDQTY !== undefined ? r.BMOAPPROVEDQTY : r.ANLQTY || 0);
      const isApproved = (Number(r.BMOAPPROVEDQTY1 || 0) > 0 && r.CMHOAPRSTATUS === 'Y');
      return {
        slNo: idx + 1,
        anualIndentId: r.ANUALINDENTID,
        facilityId: r.FACILITYID,
        facilityName: r.FACILITYNAME,
        itemCode: r.ITEMCODE,
        itemId: r.ITEMID,
        itemName: r.ITEMNAME,
        consumption: Number(r.CONSUMPTION || 0),
        currentStock: Number(r.CURRENTSTOCK || 0),
        anlQty: Number(r.ANLQTY || 0),
        bmoApprovedQty: bmoApprovedQty,
        cmhoAprStatus: r.CMHOAPRSTATUS || 'N',
        isApproved: isApproved
      };
    });
  } catch (error) {
    console.error('Error fetching DAO Facility Items:', error);
    throw error;
  }
}

/**
 * Approve Single Item (imgBtnAdd_Click)
 */
async function approveDaoItem(anualIndentId, itemId, facilityId, finYearId, approveQty) {
  try {
    const aiId = Number(anualIndentId);
    const itmId = Number(itemId);
    const facId = Number(facilityId);
    const fyId = Number(finYearId) || 547;
    const aprQty = Number(approveQty) || 0;

    const strQuery = `
      update Anualindent 
      set CMHOAPPROVEDQTY = :aprQty, CMHOAPRSTATUS = 'Y'  
      where ANUALINDENTID = :aiId 
        and itemid = :itmId 
        and facilityid = :facId  
        and accyrsetid = :fyId
    `;

    await db.execute(strQuery, { aprQty, aiId, itmId, facId, fyId }, { autoCommit: true });
    return { success: true };
  } catch (error) {
    console.error('Error approving DAO Item:', error);
    throw error;
  }
}

/**
 * Approve Batch Items
 */
async function approveDaoBatchItems(items, finYearId) {
  let connection;
  try {
    connection = await db.getConnection();
    const fyId = Number(finYearId) || 547;

    for (const item of items) {
      const aiId = Number(item.anualIndentId);
      const itmId = Number(item.itemId);
      const facId = Number(item.facilityId);
      const aprQty = Number(item.bmoApprovedQty !== undefined ? item.bmoApprovedQty : (item.anlQty || 0));

      const strQuery = `
        update Anualindent 
        set CMHOAPPROVEDQTY = :aprQty, CMHOAPRSTATUS = 'Y'  
        where ANUALINDENTID = :aiId 
          and itemid = :itmId 
          and facilityid = :facId  
          and accyrsetid = :fyId
      `;
      await connection.execute(strQuery, { aprQty, aiId, itmId, facId, fyId });
    }

    await connection.commit();
    return { success: true, count: items.length };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error in approveDaoBatchItems:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Bind Dispatch Detail (BindDispatchDedail)
 */
async function getDaoDispatchDetails(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    const strQuery = `
      select distinct dispatchno, to_char(dispatchdate, 'dd-mm-yyyy') as dispatchdate, chcapprove, cmhoapprove 
      from masanualindent a 
      inner join masfacilities mf on mf.facilityid = a.facilityid   
      where a.status = 'C' 
        and mf.isactive = 1 
        and mf.facilitytypeid = 371 
        and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14)
        and a.accyrsetid = :fyId 
        and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
    `;

    const res = await db.execute(strQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      const isCompleted = (row.CMHOAPPROVE === 'C' || row.CHCAPPROVE === 'C');
      return {
        dispatchNo: row.DISPATCHNO || '',
        dispatchDate: row.DISPATCHDATE || '',
        cmhoApprove: row.CMHOAPPROVE || '',
        isCompleted
      };
    }
    return { dispatchNo: '', dispatchDate: '', cmhoApprove: '', isCompleted: false };
  } catch (error) {
    console.error('Error fetching DAO dispatch details:', error);
    throw error;
  }
}

/**
 * Save Dispatch Details (btnsave_Click)
 */
async function saveDaoDispatchDetails(facilityId, finYearId, dispatchNo, dispatchDate) {
  let connection;
  try {
    connection = await db.getConnection();
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const dispNo = String(dispatchNo || '').trim();
    const dispDate = String(dispatchDate || '').trim();

    const astr = `
      select a.indentid  
      from masAnualindent a 
      inner join masfacilities mf on mf.facilityid = a.facilityid   
      where a.accyrsetid = :fyId 
        and mf.facilitytypeid = 371 
        and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
        and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
    `;

    const dt = await connection.execute(astr, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = dt.rows || [];

    for (const r of rows) {
      const indentId = r.INDENTID;
      const strlqr = `
        update masAnualIndent  
        set dispatchno = :dispNo, 
            dispatchdate = TO_DATE(:dispDate, 'DD-MM-YYYY') 
        where accyrsetid = :fyId and indentid = :indentId
      `;
      await connection.execute(strlqr, { dispNo, dispDate, fyId, indentId });
    }

    await connection.commit();
    return { success: true, count: rows.length };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error saving DAO dispatch details:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

/**
 * Freeze DAO Indent (btnComplete_Click)
 */
async function freezeDaoIndent(facilityId, finYearId) {
  let connection;
  try {
    connection = await db.getConnection();
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    // 1. Validation: Getallapprove()
    const strSubmitted = `
      select count(distinct a.facilityid) as cnt    
      from masAnualindent a 
      inner join masfacilities mf on mf.facilityid = a.facilityid 
      where a.status = 'C' and mf.isactive = 1 and mf.facilitytypeid = 371 
        and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
        and a.accyrsetid = :fyId 
        and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId) 
        and a.facilityid not in (:facId)
    `;
    const resSubmitted = await connection.execute(strSubmitted, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const submittedCount = Number(resSubmitted.rows?.[0]?.CNT || 0);

    const strTotal = `
      select count(facilityid) as cnt 
      from masfacilities 
      where isactive = 1 and facilitytypeid = 371 
        and nvl(AYFACTYPEID, 0) not in (11, 12, 13, 14) 
        and districtid in (select distinct districtid from masfacilities where facilityid = :facId) 
        and facilityid not in (:facId)
    `;
    const resTotal = await connection.execute(strTotal, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const totalCount = Number(resTotal.rows?.[0]?.CNT || 0);

    if (submittedCount !== totalCount) {
      // Get unfreezed facilities
      const strMissingFac = `
        select distinct mf.facilityname, a.itemcode 
        from Anualindent a   
        inner join masfacilities mf on mf.facilityid = a.facilityid  
        where mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId) 
          and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
          and a.status = 'C' and mf.facilitytypeid = 371 and mf.isactive = 1 
          and a.accyrsetid = :fyId 
          and a.facilityindentqty > 0 
          and a.CMHOAPRSTATUS is null
      `;
      const resMissingFac = await connection.execute(strMissingFac, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const facNames = (resMissingFac.rows || []).map(r => `${r.FACILITYNAME}-${r.ITEMCODE}`).join(', ');

      return {
        success: false,
        validationError: 'FACILITIES_NOT_SUBMITTED',
        message: 'Your all facilities have not freezed/submitted annual indents.',
        detail: facNames
      };
    }

    // 2. Validation: GetallapprovedItem()
    const strApprovedItems = `
      select sum(totAIcnt) as totAIcnt, sum(CHCaprovcnt) as CHCaprovcnt 
      from ( 
        select count(a.facilityid) as totAIcnt, 0 as CHCaprovcnt 
        from Anualindent a 
        inner join masfacilities mf on mf.facilityid = a.facilityid 
        where mf.isactive = 1 and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
          and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)  
          and mf.facilitytypeid = 371 and a.status = 'C' 
          and a.accyrsetid = :fyId and a.facilityindentqty > 0  
        union all 
        select 0 as totAIcnt, count(a.facilityid) as CHCaprovcnt 
        from Anualindent a 
        inner join masfacilities mf on mf.facilityid = a.facilityid 
        where mf.isactive = 1 and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
          and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)   
          and a.facilityindentqty > 0 and mf.facilitytypeid = 371 and a.status = 'C'
          and a.accyrsetid = :fyId and a.CMHOAPRSTATUS is not null
      )
    `;
    const resApprItems = await connection.execute(strApprovedItems, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const totItems = Number(resApprItems.rows?.[0]?.TOTAICNT || 0);
    const approvedItems = Number(resApprItems.rows?.[0]?.CHCAPROVCNT || 0);

    if (totItems !== approvedItems) {
      // Get unapproved items
      const strNotAppr = `
        select a.itemid, a.facilityid, mf.facilityname, a.itemcode 
        from Anualindent a   
        inner join masfacilities mf on mf.facilityid = a.facilityid  
        where nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
          and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)  
          and a.status = 'C' and mf.facilitytypeid = 371 and mf.isactive = 1 
          and a.accyrsetid = :fyId 
          and a.facilityindentqty > 0 
          and a.CMHOAPRSTATUS is null
      `;
      const resNotAppr = await connection.execute(strNotAppr, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const itemCodes = (resNotAppr.rows || []).map(r => r.ITEMCODE).join(', ');

      return {
        success: false,
        validationError: 'ITEMS_NOT_APPROVED',
        message: 'Please approve all items before freezing.',
        detail: itemCodes
      };
    }

    // 3. Freeze update: CMHOAPPROVE = 'C'
    const astr = `
      select a.indentid  
      from masAnualindent a 
      inner join masfacilities mf on mf.facilityid = a.facilityid   
      where a.accyrsetid = :fyId 
        and nvl(mf.AYFACTYPEID, 0) not in (11, 12, 13, 14) 
        and mf.facilitytypeid = 371 
        and mf.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
    `;
    const dt = await connection.execute(astr, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = dt.rows || [];

    for (const r of rows) {
      const indentId = r.INDENTID;
      const strSQL = `
        update masAnualindent 
        set CMHOAPPROVE = 'C' 
        where accyrsetid = :fyId and indentid = :indentId
      `;
      await connection.execute(strSQL, { fyId, indentId });
    }

    await connection.commit();
    return { success: true, message: 'Approved & Freezed Successfully', count: rows.length };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error freezing DAO Indent:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

module.exports = {
  getDaoFinYears,
  getDaoCategories,
  getDaoDrugs,
  getDaoFacilityItems,
  approveDaoItem,
  approveDaoBatchItems,
  getDaoDispatchDetails,
  saveDaoDispatchDetails,
  freezeDaoIndent
};
