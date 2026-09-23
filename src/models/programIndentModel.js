const db = require('../config/db');
const oracledb = require('oracledb');

// Fetch programs from masprogram
async function getPrograms() {
  try {
    const query = `
      select p.PROGRAMID, p.PROGRAM 
      from masprogram p 
      order by p.PROGRAM
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map(r => ({
      programId: r.PROGRAMID !== undefined ? r.PROGRAMID : (r.programId || r.PROGRAMID),
      programName: r.PROGRAM || r.program || ''
    }));
  } catch (error) {
    console.error('Error fetching programs:', error);
    return [
      { programId: 16, programName: 'Ayush- Crude' },
      { programId: 37, programName: 'Vayomitra Homeo Classic' },
      { programId: 38, programName: 'Anemia Homeo' },
      { programId: 39, programName: 'NPCDCS Homeo' },
      { programId: 40, programName: 'Osteoarthritis Homeo' },
      { programId: 41, programName: 'Vayomitra Unani Classic' }
    ];
  }
}

// Fetch Financial Years
async function getFinYears() {
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
    console.error('Error fetching fin years:', error);
    return [{ accYrSetId: 547, accYear: '2026-2027', isCurrent: true }];
  }
}

// Fetch Program Indent List
async function getProgramIndentList(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const query = `
      select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate,
             CASE a.Status   
               WHEN 'I' THEN 'Incomplete'  
               WHEN 'S' THEN 'Sent for Approval'  
               WHEN 'C' THEN 'Completed'  
               ELSE 'Completed'
             end status, 
             c.AccYear, a.facilityID, p.program as programname, a.aicategoryid as programid
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      left outer join masprogram p on p.programid = a.aicategoryid
      where a.facilityID = :facId 
        and a.AccYrSetID = :fyId
        and a.aicategoryid is not null
      order by a.indentdate desc, a.indentid desc
    `;

    const result = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      indentId: r.INDENTID || r.indentId,
      indentNo: r.INDENTNO || r.indentNo || '-',
      indentDate: r.INDENTDATE || r.indentDate || '-',
      status: r.STATUS || r.status || 'Incomplete',
      accYear: r.ACCYEAR || r.accYear || '-',
      facilityId: r.FACILITYID || r.facilityId,
      programId: r.PROGRAMID || r.programId || 0,
      programName: r.PROGRAMNAME || r.programName || 'General Program'
    }));
  } catch (error) {
    console.error('Error fetching Program Indent List:', error);
    return [];
  }
}

// Fetch Single Program Indent Header
async function getProgramIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const query = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.aicategoryid as programid, p.program as programname
        from masAnualIndent a
        left outer join masprogram p on p.programid = a.aicategoryid
        where a.indentid = :indId and a.facilityid = :facId
      `;
      const result = await db.execute(query, { indId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (result.rows && result.rows.length > 0) {
        const r = result.rows[0];
        return {
          indentId: r.INDENTID || r.indentId,
          indentNo: r.INDENTNO || r.indentNo,
          indentDate: r.INDENTDATE || r.indentDate,
          status: r.STATUS || r.status,
          programId: r.PROGRAMID || r.programId || 0,
          programName: r.PROGRAMNAME || r.programName || '',
          exists: true
        };
      }
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      programId: 0,
      programName: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Program Indent Header:', error);
    throw error;
  }
}

// Generate & Create Program Indent Header
async function generateProgramIndentHeader(facilityId, finYearId, programId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const progId = Number(programId);

    // Get short financial year code e.g. "26-27"
    let shYear = '26-27';
    const yrQuery = `select shaccyear, accyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (yrRes.rows && yrRes.rows.length > 0) {
      const row = yrRes.rows[0];
      const sh = row.SHACCYEAR || row.shaccyear;
      const accYr = row.ACCYEAR || row.accyear;
      if (sh && sh.length <= 5 && sh.includes('-')) {
        shYear = sh;
      } else if (accYr && accYr.includes('-')) {
        const parts = accYr.split('-');
        const y1 = parts[0].trim().slice(-2);
        const y2 = parts[1].trim().slice(-2);
        shYear = `${y1}-${y2}`;
      } else if (sh) {
        shYear = sh;
      }
    }

    // Auto generate code: facId/PI00001/shYear (e.g., 23558/PI00001/26-27)
    const seqQuery = `
      select nvl(max(auto_aicode), 0) + 1 as nextcode 
      from masAnualIndent 
      where facilityid = :facId 
        and accyrsetid = :fyId 
        and aicategoryid is not null
    `;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/PI${codeStr}/${shYear}`;

    // Get Next Indent ID
    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    // Post data to masAnualIndent table
    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode, aicategoryid, entrydate)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, :progId, sysdate)
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode, progId }, { autoCommit: true });

    let programName = '';
    if (progId) {
      const pQuery = `select program from masprogram where programid = :progId`;
      const pRes = await db.execute(pQuery, { progId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (pRes.rows && pRes.rows.length > 0) {
        programName = pRes.rows[0].PROGRAM || pRes.rows[0].program || '';
      }
    }

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      programId: progId,
      programName,
      exists: true
    };
  } catch (error) {
    console.error('Error generating Program Indent Header:', error);
    throw error;
  }
}

// Update Program Indent Header
async function updateProgramIndentHeader(facilityId, indentId, programId, finYearId) {
  try {
    const indId = Number(indentId);
    const progId = Number(programId);
    const fyId = Number(finYearId) || 547;

    const query = `
      update masAnualIndent 
      set aicategoryid = :progId,
          accyrsetid = :fyId
      where indentid = :indId
    `;
    await db.execute(query, { progId, fyId, indId }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error updating Program Indent Header:', error);
    throw error;
  }
}

// Delete Program Indent Header & Items
async function deleteProgramIndent(facilityId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `delete from anualindent where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `delete from masanualindent where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Program Indent:', error);
    throw error;
  }
}

// Fetch Items Dropdown options filtering by programId
async function getItemsDropdown(programId) {
  try {
    const progId = Number(programId) || 0;
    let rows = [];

    if (progId > 0) {
      const query = `
        select p.PROGRAMID, p.PROGRAM, pi.ITEMID, m.itemcode, m.itemname, m.strength1, m.unit, 
               c.CATEGORYID, c.CATEGORYNAME, mc.mcid, mc.MCATEGORY, m.unitcount, m.multiple
        from masprogram p
        inner join masprogramitems pi on pi.programid = p.programid
        inner join masitems m on m.itemid = pi.itemid
        left outer join masitemcategories c on c.categoryid = m.categoryid
        left outer join masitemmaincategory mc on mc.mcid = c.mcid
        where p.programid = :progId
        order by m.itemname
      `;
      const result = await db.execute(query, { progId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      rows = result.rows || [];
    }

    // Fallback if programId is 0 or if the selected program has no mapped items in masprogramitems
    if (rows.length === 0) {
      const fallbackQuery = `
        select m.itemid, m.itemcode, m.itemname, m.strength1, m.unit, c.categoryname
        from masitems m
        left outer join masitemcategories c on c.categoryid = m.categoryid
        where m.isfreez_itpr is null
        order by m.itemname
      `;
      const fallbackResult = await db.execute(fallbackQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      rows = fallbackResult.rows || [];
    }

    return rows.map(r => ({
      itemId: r.ITEMID !== undefined ? r.ITEMID : (r.itemId || r.ITEMID),
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      categoryName: r.CATEGORYNAME || r.categoryName || '-',
      mCategory: r.MCATEGORY || r.mCategory || '-',
      unitCount: r.UNITCOUNT || r.unitCount || 1,
      multiple: r.MULTIPLE || r.multiple || 1
    }));
  } catch (error) {
    console.error('Error fetching items dropdown:', error);
    return [];
  }
}



// Fetch saved items for a Program Indent
async function getProgramIndentItems(indentId) {
  try {
    const indId = Number(indentId);
    const query = `
      select ai.anualindentid, ai.indentid, ai.itemid, ai.facilityindentqty as qty,
             m.itemcode, m.itemname, m.strength1, m.unit, g.groupname
      from anualindent ai
      inner join masitems m on m.itemid = ai.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      where ai.indentid = :indId
      order by m.itemname
    `;
    const result = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualIndentId,
      indentId: r.INDENTID || r.indentId,
      itemId: r.ITEMID || r.itemId,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      groupName: r.GROUPNAME || r.groupName || '-',
      qty: Number(r.QTY || r.qty || 0)
    }));
  } catch (error) {
    console.error('Error fetching Program Indent Items:', error);
    return [];
  }
}

// Save or Add single item in Program Indent
async function saveProgramIndentItem(facilityId, finYearId, indentId, itemId, qty) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);
    const itmId = Number(itemId);
    const itemQty = Number(qty) || 0;

    // Get item code
    const codeRes = await db.execute(`select itemcode from masitems where itemid = :itmId`, { itmId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const code = codeRes.rows && codeRes.rows[0] ? (codeRes.rows[0].ITEMCODE || codeRes.rows[0].itemCode || '') : '';

    // Check if item already exists in this indent
    const checkQuery = `select anualindentid from anualindent where indentid = :indId and itemid = :itmId`;
    const checkRes = await db.execute(checkQuery, { indId, itmId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (checkRes.rows && checkRes.rows.length > 0) {
      const anualIndentId = checkRes.rows[0].ANUALINDENTID || checkRes.rows[0].anualIndentId;
      const updateQuery = `update anualindent set facilityindentqty = :itemQty where anualindentid = :anualIndentId`;
      await db.execute(updateQuery, { itemQty, anualIndentId }, { autoCommit: true });
    } else {
      const idQuery = `select nvl(max(anualindentid), 0) + 1 as nextid from anualindent`;
      const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const nextId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

      const insertQuery = `
        insert into anualindent (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, facilityindentqty, status, entrydate)
        values (:nextId, :indId, :facId, :itmId, :code, :fyId, :itemQty, 'I', sysdate)
      `;
      await db.execute(insertQuery, { nextId, indId, facId, itmId, code, fyId, itemQty }, { autoCommit: true });
    }

    return true;
  } catch (error) {
    console.error('Error saving Program Indent Item:', error);
    throw error;
  }
}

// Delete Item from Program Indent
async function deleteProgramIndentItem(anualIndentId) {
  try {
    const id = Number(anualIndentId);
    const query = `delete from anualindent where anualindentid = :id`;
    await db.execute(query, { id }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting Program Indent Item:', error);
    throw error;
  }
}

// Freeze / Complete Program Indent
async function freezeProgramIndent(facilityId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Program Indent:', error);
    throw error;
  }
}

// Save multiple items in Program Indent
async function saveBulkProgramIndentItems(facilityId, finYearId, indentId, items) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!Array.isArray(items) || items.length === 0) return true;

    for (const itm of items) {
      const itmId = Number(itm.itemId);
      const itemQty = Number(itm.qty) || 0;
      if (!itmId) continue;

      if (itemQty <= 0) {
        // If qty is 0, delete existing record if present
        await db.execute(`delete from anualindent where indentid = :indId and itemid = :itmId`, { indId, itmId }, { autoCommit: true });
        continue;
      }

      // Get item code
      const codeRes = await db.execute(`select itemcode from masitems where itemid = :itmId`, { itmId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const code = codeRes.rows && codeRes.rows[0] ? (codeRes.rows[0].ITEMCODE || codeRes.rows[0].itemCode || '') : '';

      // Check if item already exists in this indent
      const checkQuery = `select anualindentid from anualindent where indentid = :indId and itemid = :itmId`;
      const checkRes = await db.execute(checkQuery, { indId, itmId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      if (checkRes.rows && checkRes.rows.length > 0) {
        const anualIndentId = checkRes.rows[0].ANUALINDENTID || checkRes.rows[0].anualIndentId;
        const updateQuery = `update anualindent set facilityindentqty = :itemQty where anualindentid = :anualIndentId`;
        await db.execute(updateQuery, { itemQty, anualIndentId }, { autoCommit: true });
      } else {
        const idQuery = `select nvl(max(anualindentid), 0) + 1 as nextid from anualindent`;
        const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const nextId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

        const insertQuery = `
          insert into anualindent (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, facilityindentqty, status, entrydate)
          values (:nextId, :indId, :facId, :itmId, :code, :fyId, :itemQty, 'I', sysdate)
        `;
        await db.execute(insertQuery, { nextId, indId, facId, itmId, code, fyId, itemQty }, { autoCommit: true });
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving bulk program indent items:', error);
    throw error;
  }
}

module.exports = {
  getPrograms,
  getFinYears,
  getProgramIndentList,
  getProgramIndentHeader,
  generateProgramIndentHeader,
  updateProgramIndentHeader,
  deleteProgramIndent,
  getItemsDropdown,
  getProgramIndentItems,
  saveProgramIndentItem,
  saveBulkProgramIndentItems,
  deleteProgramIndentItem,
  freezeProgramIndent
};

