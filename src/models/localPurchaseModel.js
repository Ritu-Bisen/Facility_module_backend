const db = require('../config/db');

async function getBudgets() {
  const sql = `select lpbudgetid as budgetid, budgetname from MASLPBUDGET`;
  const result = await db.execute(sql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    budgetId: r.BUDGETID || r.budgetid,
    budgetName: r.BUDGETNAME || r.budgetname
  }));
}

async function getBudgetDetails(facilityId, budgetId) {
  let whereClause = '';
  const binds = { facilityId };

  if (budgetId && budgetId !== '0') {
    whereClause = ' and bd.lpbudgetid = :budgetId';
    binds.budgetId = budgetId;
  }

  const sql = `
    select lbd.budgetname, detailid, lbd.lpbudgetid, headcode, headdetails, recvfund, to_char(recvdate,'dd-MM-yyyy') as recvdate, facilityid, Remarks
    from MASLPBUDGETDETAIL bd 
    inner join maslpbudget lbd on lbd.lpbudgetid = bd.lpbudgetid
    where 1=1 ${whereClause} and bd.facilityid = :facilityId
  `;
  
  const result = await db.execute(sql, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    budgetName: r.BUDGETNAME || r.budgetname,
    detailId: r.DETAILID || r.detailid,
    lpBudgetId: r.LPBUDGETID || r.lpbudgetid,
    headCode: r.HEADCODE || r.headcode,
    headDetails: r.HEADDETAILS || r.headdetails,
    recvFund: r.RECVFUND || r.recvfund,
    recvDate: r.RECVDATE || r.recvdate,
    facilityId: r.FACILITYID || r.facilityid,
    remarks: r.REMARKS || r.Remarks || r.remarks
  }));
}

async function addBudgetDetail(data, facilityId) {
  const sql = `
    INSERT INTO MASLPBUDGETDETAIL (
      LPBUDGETID, HEADCODE, HEADDETAILS, RECVFUND, RECVDATE, REMARKS, FACILITYID
    ) VALUES (
      :lpBudgetId, :headCode, :headDetails, :recvFund, TO_DATE(:recvDate, 'YYYY-MM-DD'), :remarks, :facilityId
    )
  `;
  
  await db.execute(sql, {
    lpBudgetId: data.lpBudgetId,
    headCode: data.headCode || null,
    headDetails: data.headDetails || null,
    recvFund: data.recvFund || 0,
    recvDate: data.recvDate,
    remarks: data.remarks || null,
    facilityId: facilityId
  }, { autoCommit: true });
}

// ==========================================
// Local Suppliers Master
// ==========================================

async function getSuppliers(facilityId) {
  const sql = `
    SELECT 
      LPSupplierID, SupplierCode, SupplierName, Address, City, Email, Phone1,
      (SELECT CASE count(*) WHEN 0 THEN 'True' ELSE 'False' END
       FROM lpcontracts LPC
       INNER JOIN lpmassuppliers LPMS ON (LPMS.LpSupplierID = LPC.LpSupplierID)
       WHERE LPMS.LPSupplierID = main.LPSupplierID
      ) as Deletable
    FROM LPMasSuppliers main
    WHERE PsaID = :facilityId 
    ORDER BY SupplierName
  `;
  const result = await db.execute(sql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  return result.rows.map(r => ({
    lpSupplierId: r.LPSUPPLIERID || r.lpsupplierid,
    supplierCode: r.SUPPLIERCODE || r.suppliercode,
    supplierName: r.SUPPLIERNAME || r.suppliername,
    address: r.ADDRESS || r.address,
    city: r.CITY || r.city,
    email: r.EMAIL || r.email,
    phone1: r.PHONE1 || r.phone1,
    deletable: (r.DELETABLE || r.deletable) === 'True'
  }));
}

async function getSupplierById(supplierId) {
  const sql = `SELECT * FROM LPMasSuppliers WHERE LPSupplierID = :supplierId`;
  const result = await db.execute(sql, { supplierId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    lpSupplierId: r.LPSUPPLIERID || r.lpsupplierid,
    supplierCode: r.SUPPLIERCODE || r.suppliercode,
    supplierName: r.SUPPLIERNAME || r.suppliername,
    address: r.ADDRESS || r.address,
    city: r.CITY || r.city,
    email: r.EMAIL || r.email,
    phone1: r.PHONE1 || r.phone1,
    psaId: r.PSAID || r.psaid
  };
}

async function createSupplier(data, facilityId) {
  // Check duplicates
  const checkSql = `
    SELECT count(*) as cnt FROM LPMasSuppliers 
    WHERE (SupplierCode = :code OR SupplierName = :name) AND PsaID = :facilityId
  `;
  const checkRes = await db.execute(checkSql, { 
    code: data.supplierCode || '', 
    name: data.supplierName, 
    facilityId 
  }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const count = checkRes.rows[0].CNT || checkRes.rows[0].cnt;
  if (count > 0) {
    throw new Error('Duplicate Supplier Code or Name found.');
  }

  // Generate code if empty
  let supplierCode = data.supplierCode;
  if (!supplierCode) {
    const codeSql = `SELECT Lpad(NVL(Max(To_Number(SubStr(SupplierCode, 4))), 0) + 1, 5, '0') as WHSlNo FROM LPmasSuppliers WHERE SupplierCode Like 'LP%'`;
    const codeRes = await db.execute(codeSql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    const nextSeq = codeRes.rows.length > 0 ? (codeRes.rows[0].WHSLNO || codeRes.rows[0].whslno) : '00001';
    supplierCode = 'LP' + nextSeq;
  }

  const sql = `
    INSERT INTO LPMasSuppliers (SupplierCode, SupplierName, Address, PsaID, City, Email, Phone1)
    VALUES (:code, :name, :address, :facilityId, :city, :email, :phone)
  `;
  
  await db.execute(sql, {
    code: supplierCode,
    name: data.supplierName,
    address: data.address || null,
    facilityId: facilityId,
    city: data.city || null,
    email: data.email || null,
    phone: data.phone1 || null
  }, { autoCommit: true });

  return supplierCode;
}

async function updateSupplier(supplierId, data, facilityId) {
  // Check duplicates excluding current ID
  const checkSql = `
    SELECT count(*) as cnt FROM LPMasSuppliers 
    WHERE (SupplierCode = :code OR SupplierName = :name) 
      AND PsaID = :facilityId 
      AND LPSupplierID != :supplierId
  `;
  const checkRes = await db.execute(checkSql, { 
    code: data.supplierCode || '', 
    name: data.supplierName, 
    facilityId,
    supplierId
  }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const count = checkRes.rows[0].CNT || checkRes.rows[0].cnt;
  if (count > 0) {
    throw new Error('Duplicate Supplier Code or Name found.');
  }

  const sql = `
    UPDATE LPMasSuppliers SET
      SupplierName = :name,
      Address = :address,
      City = :city,
      Email = :email,
      Phone1 = :phone
    WHERE LPSupplierID = :supplierId
  `;
  await db.execute(sql, {
    name: data.supplierName,
    address: data.address || null,
    city: data.city || null,
    email: data.email || null,
    phone: data.phone1 || null,
    supplierId: supplierId
  }, { autoCommit: true });
}

async function deleteSupplier(supplierId) {
  const sql = `DELETE FROM LPMasSuppliers WHERE LPSupplierID = :supplierId`;
  await db.execute(sql, { supplierId }, { autoCommit: true });
}

async function getSupplyOrders(facilityId, finYearId, status) {
  let statusFilter = '';
  const binds = { facilityId, finYearId };

  if (status && status !== 'All') {
    statusFilter = " AND a1.Status LIKE :status";
    binds.status = status;
  }

  const sql = `
    SELECT 
      a.PoNoID as "poNoId",
      a.PoNo as "poNo",
      to_char(a.PoDate, 'dd-MM-yyyy') as "poDate",
      a1.Status as "status",
      a.IsScheduleLater as "isScheduleLater",
      a.AmendNo as "amendNo",
      a.SupplierID as "supplierId",
      a.LPSupplierID as "lpSupplierId",
      nvl(a.SOValue,0) as "soValue",
      Nvl(to_char(SupConfirmationDate,'dd-MM-yyyy'),'') as "supConfirmationDate",
      Nvl(SupConfirmationRemarks,'') as "supConfirmationRemarks",
      m1.SupplierName as "mainSupplierName",
      m2.SupplierName as "lpSupplierName"
    FROM LPsoOrderPlaced a
    INNER JOIN v_LPsoOrderStatus a1 on (a1.PoNoID=a.PoNoID)
    LEFT OUTER JOIN masSuppliers m1 on (m1.SupplierID=a.SupplierID)
    LEFT OUTER JOIN LPmasSuppliers m2 on (m2.LPSupplierID=a.LPSupplierID)
    WHERE a.AccYrSetID = :finYearId 
      AND a.PSAID = :facilityId
      ${statusFilter}
    ORDER BY a.PoDate
  `;
  const result = await db.execute(sql, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });

  return result.rows.map(r => {
    const supplierId = r.supplierId || r.SUPPLIERID;
    const lpSupplierId = r.lpSupplierId || r.LPSUPPLIERID;
    
    return {
      id: r.poNoId || r.PONOID,
      poNo: r.poNo || r.PONO,
      poDate: r.poDate || r.PODATE,
      status: r.status || r.STATUS,
      isScheduleLater: r.isScheduleLater || r.ISSCHEDULELATER,
      amendNo: r.amendNo || r.AMENDNO,
      supplierId: supplierId,
      lpSupplierId: lpSupplierId,
      soValue: r.soValue || r.SOVALUE,
      supConfirmationDate: r.supConfirmationDate || r.SUPCONFIRMATIONDATE,
      supConfirmationRemarks: r.supConfirmationRemarks || r.SUPCONFIRMATIONREMARKS,
      supplierName: supplierId ? (r.mainSupplierName || r.MAINSUPPLIERNAME) : (r.lpSupplierName || r.LPSUPPLIERNAME)
    };
  });
}

async function getSupplyOrderDetails(poNoId) {
  // 1. Fetch header details
  const headerSql = `
    SELECT 
      a.PoNoID as "poNoId",
      a.PoNo as "poNo",
      to_char(a.PoDate, 'dd-MM-yyyy') as "poDate",
      a.SupplierID as "supplierId",
      a.LPSupplierID as "lpSupplierId",
      a.AccYrSetID as "accYrSetId",
      a.contractid as "contractId",
      a.CategoryID as "categoryId",
      nvl(a.SOValue,0) as "soValue",
      m1.SupplierName as "mainSupplierName",
      m2.SupplierName as "lpSupplierName",
      m2.Address as "lpAddress",
      m2.City as "lpCity",
      m2.Phone1 as "lpPhone",
      b.ShAccYear as "shAccYear",
      c.Contractno as "contractNo",
      (SELECT COUNT(PoNoID) FROM LPSoordereditems c2 WHERE c2.PoNoID = a.PoNoID) as "itemCnt"
    FROM LPsoOrderPlaced a
    LEFT JOIN MasSuppliers m1 ON a.SupplierID = m1.SupplierID
    LEFT JOIN LPMasSuppliers m2 ON a.LPSupplierID = m2.LPSupplierID
    INNER JOIN masAccYearSettings b ON a.AccYrSetID = b.AccYrSetID
    LEFT OUTER JOIN lpcontracts c ON c.contractid = a.contractid
    WHERE a.PoNoID = :poNoId
  `;
  const headerResult = await db.execute(headerSql, { poNoId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const header = headerResult.rows.length > 0 ? headerResult.rows[0] : null;

  if (!header) return null;

  const h = {
    poNoId: header.poNoId || header.PONOID,
    poNo: header.poNo || header.PONO,
    poDate: header.poDate || header.PODATE,
    supplierId: header.supplierId || header.SUPPLIERID,
    lpSupplierId: header.lpSupplierId || header.LPSUPPLIERID,
    accYrSetId: header.accYrSetId || header.ACCYRSETID,
    contractId: header.contractId || header.CONTRACTID,
    categoryId: header.categoryId || header.CATEGORYID,
    soValue: header.soValue || header.SOVALUE,
    mainSupplierName: header.mainSupplierName || header.MAINSUPPLIERNAME,
    lpSupplierName: header.lpSupplierName || header.LPSUPPLIERNAME,
    lpAddress: header.lpAddress || header.LPADDRESS,
    lpCity: header.lpCity || header.LPCITY,
    lpPhone: header.lpPhone || header.LPPHONE,
    shAccYear: header.shAccYear || header.SHACCYEAR,
    contractNo: header.contractNo || header.CONTRACTNO,
    itemCnt: header.itemCnt || header.ITEMCNT
  };

  // Resolve final supplier name and address (prefer LP over main for this module)
  h.supplierName = h.lpSupplierName || h.mainSupplierName;
  h.address = h.lpAddress || '';
  h.city = h.lpCity || '';
  h.phone = h.lpPhone || '';

  // 2. Fetch actual items
  const items = await getSupplyOrderItems(poNoId);

  return { header: h, items };
}

async function getSupplyOrderEditDetails(poNoId) {
  const sql = `
    SELECT a.PoNoID,
           a.AccYrSetID,
           a.LPSupplierID,
           c.Contractid as contrid,
           c.Contractno,
           a.PoNo,
           a.PoDate,
           a.CategoryID,
           a.SOValue,
           (
             SELECT COUNT(PoNoID)
             FROM LPSoordereditems c
             WHERE c.PoNoID = a.PoNoID
           ) AS ItemCnt
    FROM LPsoOrderPlaced a
    LEFT OUTER JOIN lpcontracts c
            ON c.contractid = a.contractid
    WHERE a.PonoID = :poNoId
  `;
  const result = await db.execute(sql, { poNoId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const row = result.rows.length > 0 ? result.rows[0] : null;

  if (!row) return null;

  const header = {
    poNoId: row.PONOID || row.ponoid,
    accYrSetId: row.ACCYRSETID || row.accyrsetid,
    lpSupplierId: row.LPSUPPLIERID || row.lpsupplierid,
    contractId: row.CONTRID || row.contrid || row.CONTRACTID || row.contractid,
    contractNo: row.CONTRACTNO || row.contractno,
    poNo: row.PONO || row.pono,
    poDate: row.PODATE || row.podate ? new Date(row.PODATE || row.podate).toLocaleDateString('en-GB').replace(/\//g, '-') : null,
    categoryId: row.CATEGORYID || row.categoryid,
    soValue: row.SOVALUE || row.sovalue,
    itemCnt: row.ITEMCNT || row.itemcnt
  };

  const itemSql = `
    SELECT 
      a.OrderItemID,
      i.ItemCode as "joinedItemCode",
      i.ItemName as "joinedItemName",
      i.Strength as "joinedStrength",
      i.Unit as "joinedSku",
      i.ItemTypeID as "joinedType",
      i.PackingQty as "joinedPackQty",
      a.AbsQty,
      a.SingleUnitPrice,
      a.ItemValue,
      n.NocNumber as "joinedNocNumber"
    FROM LPSoordereditems a
    LEFT JOIN LPMasItems i ON a.LPItemID = i.LPItemID
    LEFT JOIN mascgmscnoc n ON a.NOCID = n.NOCID
    WHERE a.PoNoID = :poNoId
  `;
  const itemResult = await db.execute(itemSql, { poNoId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const items = itemResult.rows.map(r => ({
    orderItemId: r.ORDERITEMID || r.orderitemid,
    itemName: r.joinedItemName || r.JOINEDITEMNAME,
    drugCode: r.joinedItemCode || r.JOINEDITEMCODE,
    strength: r.joinedStrength || r.JOINEDSTRENGTH,
    sku: r.joinedSku || r.JOINEDSKU,
    itemType: r.joinedType || r.JOINEDTYPE,
    packQty: r.joinedPackQty || r.JOINEDPACKQTY,
    orderQty: r.ABSQTY || r.absqty,
    unitPrice: r.SINGLEUNITPRICE || r.singleunitprice,
    amount: r.ITEMVALUE || r.itemvalue,
    nocDetail: r.joinedNocNumber || r.JOINEDNOCNUMBER
  }));

  return {
    header,
    items
  };
}

async function getSupplyOrderItems(poNoId) {
  const sql = `
    SELECT 
      o.OrderItemID as "orderItemId",
      o.ItemID as "itemId",
      o.LPItemID as "lpItemId",
      COALESCE(m.ItemName, mi.ItemName, o.ItemName) as "itemName",
      COALESCE(m.ItemCode, mi.ItemCode) as "itemCode",
      NVL(o.AbsQty,0) as "orderQty",
      NVL(o.SINGLEUNITPRICE,0) as "unitPrice",
      o.ITEMVALUE as "amount",
      o.NOCID as "nocDetail"
    FROM LPsoOrderedItems o
    LEFT JOIN LPContractItems ci ON o.ContractItemID = ci.ContractItemID
    LEFT JOIN LPMasItems m ON m.LPItemID = COALESCE(o.LPItemID, ci.LPItemID)
    LEFT JOIN MasItems mi ON mi.ItemID = COALESCE(o.ItemID, ci.ItemID)
    WHERE o.PoNoID = :poNoId
    ORDER BY o.OrderItemID
  `;
  const res = await db.execute(sql, { poNoId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return res.rows.map((r, i) => ({
    slNo: i + 1,
    orderItemId: r.orderItemId || r.ORDERITEMID,
    itemId: r.itemId || r.ITEMID,
    lpItemId: r.lpItemId || r.LPITEMID,
    itemName: r.itemName || r.ITEMNAME,
    drugCode: (r.itemCode || r.ITEMCODE || '').toString(),
    orderQty: r.orderQty || r.ORDERQTY,
    unitPrice: r.unitPrice || r.UNITPRICE,
    amount: r.amount || r.AMOUNT,
    nocDetail: r.nocDetail || r.NOCID
  }));
}

async function addSupplyOrderItem(poNoId, itemData) {
  const seqSql = `SELECT NVL(MAX(OrderItemID),0)+1 as ID FROM LPsoOrderedItems`;
  const seqRes = await db.execute(seqSql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const newId = seqRes.rows[0].ID || seqRes.rows[0].id;
  
  const sql = `
    INSERT INTO LPsoOrderedItems (
      OrderItemID, PoNoID, ItemID, LPItemID, ItemName, AbsQty, SINGLEUNITPRICE, ITEMVALUE, NOCID
    ) VALUES (
      :orderItemId, :poNoId, :itemId, :lpItemId, :itemName, :orderQty, :unitPrice, :amount, :nocDetail
    )
  `;
  await db.execute(sql, {
    orderItemId: newId,
    poNoId: poNoId,
    itemId: itemData.itemId || null,
    lpItemId: itemData.lpItemId || null,
    itemName: itemData.itemName || '',
    orderQty: itemData.orderQty || 0,
    unitPrice: itemData.unitPrice || 0,
    amount: itemData.amount || 0,
    nocDetail: itemData.nocDetail || null
  }, { autoCommit: true });
  
  // Update SOValue in Header
  await updateSupplyOrderValue(poNoId);
  
  return { orderItemId: newId };
}

async function updateSupplyOrderItem(orderItemId, poNoId, itemData) {
  const sql = `
    UPDATE LPsoOrderedItems
    SET 
      ItemID = :itemId,
      LPItemID = :lpItemId,
      ItemName = :itemName,
      AbsQty = :orderQty,
      SINGLEUNITPRICE = :unitPrice,
      ITEMVALUE = :amount,
      NOCID = :nocDetail
    WHERE OrderItemID = :orderItemId
  `;
  await db.execute(sql, {
    orderItemId: orderItemId,
    itemId: itemData.itemId || null,
    lpItemId: itemData.lpItemId || null,
    itemName: itemData.itemName || '',
    orderQty: itemData.orderQty || 0,
    unitPrice: itemData.unitPrice || 0,
    amount: itemData.amount || 0,
    nocDetail: itemData.nocDetail || null
  }, { autoCommit: true });
  
  await updateSupplyOrderValue(poNoId);
}

async function deleteSupplyOrderItem(orderItemId, poNoId) {
  const sql = `DELETE FROM LPsoOrderedItems WHERE OrderItemID = :orderItemId`;
  await db.execute(sql, { orderItemId }, { autoCommit: true });
  
  // Update SOValue in Header
  await updateSupplyOrderValue(poNoId);
}

async function updateSupplyOrderValue(poNoId) {
  const sql = `
    UPDATE LPsoOrderPlaced 
    SET SOValue = (SELECT NVL(SUM(ITEMVALUE), 0) FROM LPsoOrderedItems WHERE PoNoID = :poNoId)
    WHERE PoNoID = :poNoId
  `;
  await db.execute(sql, { poNoId }, { autoCommit: true });
}

async function generateSupplyOrderNo(facilityId, finYearId) {
  // Logic from ASP.NET AutoGenerateLPSOCode: LP{NextSeq}/{YearCode}
  const yrSql = `SELECT shaccyear FROM masaccyearsettings WHERE accyrsetid = :finYearId`;
  const yrRes = await db.execute(yrSql, { finYearId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const yearCode = yrRes.rows.length > 0 ? yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear : '26-27';

  const psaSql = `SELECT facilityid as psacode FROM usrusers WHERE facilityid = :facilityId`;
  const psaRes = await db.execute(psaSql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const psaCode = psaRes.rows.length > 0 ? psaRes.rows[0].PSACODE || psaRes.rows[0].psacode : facilityId;

  // Next sequence (mocked as ASP.NET typically queries the max auto_socode, but for now we generate a random 5 digit for simplicity)
  // Or we can query the max from LPsoOrderPlaced
  const seqSql = `SELECT NVL(MAX(TO_NUMBER(Auto_SOCode)), 0) + 1 as NEXT_SEQ FROM LPsoOrderPlaced WHERE PSAID = :facilityId AND AccYrSetID = :finYearId AND Auto_SOCode IS NOT NULL`;
  let nextSeqStr = '00001';
  try {
    const seqRes = await db.execute(seqSql, { facilityId, finYearId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (seqRes.rows.length > 0) {
      const seq = seqRes.rows[0].NEXT_SEQ || seqRes.rows[0].next_seq;
      nextSeqStr = String(seq).padStart(5, '0');
    }
  } catch (err) {
    // ignore parsing errors and use fallback
  }

  const generatedNo = `${psaCode}-LP${nextSeqStr}/${yearCode}`;
  
  return {
    soNo: generatedNo,
    psaCode: psaCode,
    supplierCode: 'LP',
    autoSoCode: nextSeqStr,
    yearCode: yearCode
  };
}

async function saveSupplyOrderHeader(facilityId, data) {
  let { poNoId, accYrSetId, sourceId, schemeId, lpSupplierId, contractId, poNo, poDate, categoryId, psaCode, icCode, supplierCode, autoSoCode } = data;
  
  sourceId = sourceId || 1;
  schemeId = schemeId || 1;
  categoryId = categoryId || 1;
  icCode = icCode || '';

  if (!poNoId || poNoId === '0' || poNoId === 0) {
    // Insert
    const sql = `
      INSERT INTO LPsoOrderPlaced (
        contractid, AccYrSetID, SourceID, SchemeID, LPSupplierID, PONO, PODate, PSAID, CategoryID, PSA_SOCode, IC_SOCode, Sup_SOCode, Auto_SOCode
      ) VALUES (
        :contractId, :accYrSetId, :sourceId, :schemeId, :lpSupplierId, :poNo, TO_DATE(:poDate, 'DD-MM-YYYY'), :facilityId, :categoryId, :psaCode, :icCode, :supplierCode, :autoSoCode
      )
    `;
    
    // In oracle we might need returning into to get the ID, but for simplicity we'll query it back
    await db.execute(sql, {
      contractId, accYrSetId, sourceId, schemeId, lpSupplierId, poNo, poDate, facilityId, categoryId, psaCode, icCode, supplierCode, autoSoCode
    }, { autoCommit: true });

    const getSql = `SELECT PoNoID FROM LPsoOrderPlaced WHERE PoNo = :poNo AND PSAID = :facilityId`;
    const getRes = await db.execute(getSql, { poNo, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (getRes.rows.length > 0) {
      return getRes.rows[0].PONOID || getRes.rows[0].ponoid;
    }
    return null;
  } else {
    // Update
    const sql = `
      UPDATE LPsoOrderPlaced SET 
        contractid = :contractId,
        AccYrSetID = :accYrSetId,
        SourceID = :sourceId,
        SchemeID = :schemeId,
        LPSupplierID = :lpSupplierId,
        PONO = :poNo,
        PODate = TO_DATE(:poDate, 'DD-MM-YYYY'),
        CategoryID = :categoryId
      WHERE PoNoID = :poNoId AND PSAID = :facilityId
    `;
    await db.execute(sql, {
      contractId, accYrSetId, sourceId, schemeId, lpSupplierId, poNo, poDate, categoryId, poNoId, facilityId
    }, { autoCommit: true });
    
    return poNoId;
  }
}

async function getSupplierReceipts(finYearId, facilityId) {
  const soSql = `
    SELECT 
      a.PoNoID as "poNoId", 
      a.PoNo as "poNo", 
      TO_CHAR(a.PoDate, 'DD-MM-YYYY') as "poDate", 
      a.SupplierID as "supplierId",
      a.LPSupplierID as "lpSupplierId",
      sup2.SupplierName as "lpSupplierName",
      sup1.SupplierName as "mainSupplierName",
      (CASE WHEN a.status ='O' THEN 'Order Placed' ELSE a.status END) as "status"
    FROM LPsoOrderPlaced a 
    INNER JOIN usrusers m4 ON (m4.facilityid = a.psaid) 
    LEFT JOIN LPmasSuppliers sup2 ON (sup2.LPSupplierid = a.LPSupplierid)
    LEFT JOIN masSuppliers sup1 ON (sup1.SupplierID = a.SupplierID)
    WHERE a.AccYrSetID = :finYearId 
      AND m4.facilityid = :facilityId 
      AND a.Status NOT IN ('I', 'D')
    ORDER BY a.PoDate DESC
  `;
  const soRes = await db.execute(soSql, { finYearId: parseInt(finYearId, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const supplyOrders = soRes.rows.map(r => ({
    id: r.poNoId || r.PONOID,
    poNo: r.poNo || r.PONO,
    poDate: r.poDate || r.PODATE,
    supplierName: r.lpSupplierName || r.LPSUPPLIERNAME || r.mainSupplierName || r.MAINSUPPLIERNAME,
    status: r.status || r.STATUS,
    receipts: []
  }));

  if (supplyOrders.length === 0) return [];

  const rcptSql = `
    SELECT 
      a1.PoNoID as "poNoId",
      a1.fACReceiptID as "receiptId", 
      a1.FACReceiptNo as "receiptNo", 
      TO_CHAR(a1.fACReceiptDate, 'DD-MM-YYYY') as "receiptDate", 
      a1.StkRegNo as "voucherNo", 
      TO_CHAR(a1.StkRegDate, 'DD-MM-YYYY') as "voucherDate",
      a1.Status as "status"
    FROM tbfacilityreceipts a1
    INNER JOIN LPsoOrderPlaced a ON a.PoNoID = a1.PoNoID
    WHERE a.AccYrSetID = :finYearId 
      AND a1.FacilityID = :facilityId
      AND a.Status NOT IN ('I', 'D')
    ORDER BY a1.FaCReceiptDate, a1.fACReceiptNo
  `;
  const rcptRes = await db.execute(rcptSql, { finYearId: parseInt(finYearId, 10), facilityId: parseInt(facilityId, 10) }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  const receipts = rcptRes.rows.map(r => ({
    poNoId: r.poNoId || r.PONOID,
    receiptId: r.receiptId || r.RECEIPTID,
    receiptNo: r.receiptNo || r.RECEIPTNO,
    receiptDate: r.receiptDate || r.RECEIPTDATE,
    voucherNo: r.voucherNo || r.VOUCHERNO,
    voucherDate: r.voucherDate || r.VOUCHERDATE,
    status: (r.status || r.STATUS) === 'I' ? 'Incomplete' : (r.status || r.STATUS) === 'C' ? 'Completed' : (r.status || r.STATUS)
  }));

  const rcptMap = receipts.reduce((acc, curr) => {
    if (!acc[curr.poNoId]) acc[curr.poNoId] = [];
    acc[curr.poNoId].push(curr);
    return acc;
  }, {});

  supplyOrders.forEach(so => {
    if (rcptMap[so.id]) {
      so.receipts = rcptMap[so.id];
    }
  });

  return supplyOrders;
}

async function getReceiptHeaderData(mode, id, facilityId) {
  if (mode === 'edit') {
    const sql = `
      SELECT 
        a.FacReceiptID as "receiptId",
        a.PoNoID as "poNoId",
        a.FacReceiptNo as "receiptNo",
        TO_CHAR(a.FacReceiptDate, 'DD-MM-YYYY') as "receiptDate",
        a.SupplierID as "supplierId",
        p.AccYrSetID as "accYrSetId",
        y.AccYear as "accYear",
        p.SourceID as "sourceId",
        p.SchemeID as "schemeId",
        s1.SourceName as "sourceName",
        s2.SchemeName as "schemeName",
        p.PoNo as "poNo",
        TO_CHAR(p.PoDate, 'DD-MM-YYYY') as "poDate",
        COALESCE(sup1.SupplierName, sup2.SupplierName) as "supplierName",
        a.Status as "status",
        a.MRCNumber as "mrcNumber",
        a.StkRegNo as "voucherNo",
        TO_CHAR(a.StkRegDate, 'DD-MM-YYYY') as "voucherDate"
      FROM tbfacilityreceipts a
      INNER JOIN LPsoOrderPlaced p ON p.PoNoID = a.PoNoID
      INNER JOIN masAccYearSettings y ON y.AccYrSetID = p.AccYrSetID
      INNER JOIN masSources s1 ON s1.SourceID = p.SourceID
      INNER JOIN masSchemes s2 ON s2.SchemeID = p.SchemeID
      LEFT JOIN masSuppliers sup1 ON sup1.SupplierID = p.SupplierID
      LEFT JOIN LPmasSuppliers sup2 ON sup2.LPSupplierID = p.LPSupplierID
      WHERE a.FacReceiptID = :id AND a.FacilityID = :facilityId
    `;
    const res = await db.execute(sql, { id, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (res.rows.length === 0) return null;
    return res.rows[0];
  } else if (mode === 'create') {
    const sql = `
      SELECT 
        p.PoNoID as "poNoId",
        p.AccYrSetID as "accYrSetId",
        y.AccYear as "accYear",
        p.SourceID as "sourceId",
        p.SchemeID as "schemeId",
        s1.SourceName as "sourceName",
        s2.SchemeName as "schemeName",
        p.PoNo as "poNo",
        TO_CHAR(p.PoDate, 'DD-MM-YYYY') as "poDate",
        COALESCE(sup1.SupplierName, sup2.SupplierName) as "supplierName",
        p.SupplierID as "supplierId"
      FROM LPsoOrderPlaced p
      INNER JOIN masAccYearSettings y ON y.AccYrSetID = p.AccYrSetID
      INNER JOIN masSources s1 ON s1.SourceID = p.SourceID
      INNER JOIN masSchemes s2 ON s2.SchemeID = p.SchemeID
      LEFT JOIN masSuppliers sup1 ON sup1.SupplierID = p.SupplierID
      LEFT JOIN LPmasSuppliers sup2 ON sup2.LPSupplierID = p.LPSupplierID
      WHERE p.PoNoID = :id AND p.PSAID = :facilityId
    `;
    const res = await db.execute(sql, { id, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }
}

async function saveReceiptHeader(facilityId, data) {
  let receiptId = data.receiptId;
  const sqlDate = `TO_DATE(:receiptDate, 'DD-MM-YYYY')`;
  
  if (!receiptId) {
    // Generate new ID (sequence not specified, maybe auto-generated, but let's assume sequence exists or use MAX)
    // Actually, legacy says: Insert and then Select ID.
    // We will do insert returning into.
    const seqSql = `SELECT NVL(MAX(FacReceiptID),0)+1 as ID FROM tbfacilityreceipts`;
    const seqRes = await db.execute(seqSql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    receiptId = seqRes.rows[0].ID || seqRes.rows[0].id;

    const sql = `
      INSERT INTO tbfacilityreceipts (
        FacReceiptID, FacilityID, SourceID, SchemeID, FacReceiptNo, FacReceiptDate, PoNoID, SupplierID, Status
      ) VALUES (
        :receiptId, :facilityId, :sourceId, :schemeId, :receiptNo, ${sqlDate}, :poNoId, :supplierId, 'I'
      )
    `;
    await db.execute(sql, {
      receiptId,
      facilityId,
      sourceId: data.sourceId,
      schemeId: data.schemeId,
      receiptNo: data.receiptNo,
      receiptDate: data.receiptDate,
      poNoId: data.poNoId,
      supplierId: data.supplierId || null
    }, { autoCommit: true });
  } else {
    const sql = `
      UPDATE tbfacilityreceipts SET
        FacReceiptNo = :receiptNo,
        FacReceiptDate = ${sqlDate}
      WHERE FacReceiptID = :receiptId AND FacilityID = :facilityId
    `;
    await db.execute(sql, {
      receiptNo: data.receiptNo,
      receiptDate: data.receiptDate,
      receiptId,
      facilityId
    }, { autoCommit: true });
  }
  return receiptId;
}

async function getReceiptItems(receiptId, poNoId, facilityId) {
  const sql = `
    SELECT 
      o.OrderItemID as "orderItemId",
      o.ItemID as "itemId",
      o.ItemName as "itemName",
      o.LPItemID as "lpItemId",
      NVL(o.AbsQty,0) as "orderedQty",
      b.FacReceiptItemID as "receiptItemId",
      NVL(b.AbsrQty,0) as "receiptAbsQty",
      NVL(c.received,0) as "receivedQty",
      NVL(o.AbsQty,0) - NVL(b.AbsrQty,0) - NVL(c.received,0) as "balanceQty"
    FROM LPsoOrderPlaced p
    INNER JOIN LPsoOrderedItems o ON p.PoNoID = o.PoNoID
    LEFT JOIN tbfacilityreceiptItems b ON b.OrderItemID = o.OrderItemID AND b.FacReceiptID = :receiptId
    LEFT JOIN (
      SELECT x.OrderItemID, SUM(x.AbsrQty) as received 
      FROM tbfacilityreceiptItems x 
      WHERE x.FacReceiptID != :receiptId 
      GROUP BY x.OrderItemID
    ) c ON c.OrderItemID = o.OrderItemID
    WHERE p.PoNoID = :poNoId AND p.PSAID = :facilityId
    ORDER BY o.ItemName
  `;
  const res = await db.execute(sql, { receiptId: receiptId || 0, poNoId, facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return res.rows;
}

async function saveReceiptItems(receiptId, items) {
  for (let item of items) {
    if (!item.receiptItemId && item.receiptAbsQty > 0) {
      // Insert
      const seqSql = `SELECT NVL(MAX(FacReceiptItemID),0)+1 as ID FROM tbfacilityreceiptItems`;
      const seqRes = await db.execute(seqSql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
      const newId = seqRes.rows[0].ID || seqRes.rows[0].id;

      const sql = `
        INSERT INTO tbfacilityreceiptItems (
          FacReceiptItemID, FacReceiptID, OrderItemID, ItemID, AbsrQty
        ) VALUES (
          :id, :receiptId, :orderItemId, :itemId, :qty
        )
      `;
      await db.execute(sql, {
        id: newId,
        receiptId,
        orderItemId: item.orderItemId,
        itemId: item.itemId || item.lpItemId,
        qty: item.receiptAbsQty
      }, { autoCommit: true });
    } else if (item.receiptItemId && item.receiptAbsQty > 0) {
      // Update
      const sql = `
        UPDATE tbfacilityreceiptItems SET
          AbsrQty = :qty
        WHERE FacReceiptItemID = :receiptItemId
      `;
      await db.execute(sql, {
        qty: item.receiptAbsQty,
        receiptItemId: item.receiptItemId
      }, { autoCommit: true });
    } else if (item.receiptItemId && item.receiptAbsQty == 0) {
      // Delete
      const sql = `DELETE FROM tbfacilityreceiptItems WHERE FacReceiptItemID = :receiptItemId`;
      await db.execute(sql, { receiptItemId: item.receiptItemId }, { autoCommit: true });
    }
  }
}

async function getReceiptBatches(receiptId) {
  const sql = `
    SELECT 
      a.FacReceiptItemID as "receiptItemId",
      a.ItemID as "itemId",
      v.ItemName as "itemName",
      b.InwNo as "inwNo",
      b.BatchNo as "batchNo",
      b.StockLocation as "stockLocation",
      TO_CHAR(b.MfgDate, 'MM/YYYY') as "mfgDate",
      TO_CHAR(b.ExpDate, 'MM/YYYY') as "expDate",
      b.AbsRQty as "qty"
    FROM tbfacilityreceiptItems a
    LEFT JOIN vmasItems v ON a.ItemID = v.ItemID
    LEFT JOIN tbfacilityreceiptbatches b ON a.FacReceiptItemID = b.FacReceiptItemID
    WHERE a.FacReceiptID = :receiptId
    ORDER BY v.ItemName, b.ExpDate
  `;
  const res = await db.execute(sql, { receiptId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  // Group by item
  const itemsMap = {};
  res.rows.forEach(r => {
    const rId = r.receiptItemId || r.RECEIPTITEMID;
    if (!itemsMap[rId]) {
      itemsMap[rId] = {
        receiptItemId: rId,
        itemId: r.itemId || r.ITEMID,
        itemName: r.itemName || r.ITEMNAME,
        batches: []
      };
    }
    if (r.inwNo || r.INWNO) {
      itemsMap[rId].batches.push({
        inwNo: r.inwNo || r.INWNO,
        batchNo: r.batchNo || r.BATCHNO,
        stockLocation: r.stockLocation || r.STOCKLOCATION,
        mfgDate: r.mfgDate || r.MFGDATE,
        expDate: r.expDate || r.EXPDATE,
        qty: r.qty || r.QTY
      });
    }
  });

  return Object.values(itemsMap);
}

async function saveReceiptBatch(batchData) {
  let inwNo = batchData.inwNo;
  let mfgDateSql = `TO_DATE('01/' || :mfgDate, 'DD/MM/YYYY')`;
  let expDateSql = `LAST_DAY(TO_DATE('01/' || :expDate, 'DD/MM/YYYY'))`;

  if (!inwNo) {
    const seqSql = `SELECT NVL(MAX(InwNo),0)+1 as ID FROM tbfacilityreceiptbatches`;
    const seqRes = await db.execute(seqSql, {}, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    inwNo = seqRes.rows[0].ID || seqRes.rows[0].id;

    const sql = `
      INSERT INTO tbfacilityreceiptbatches (
        InwNo, FacReceiptItemID, ItemID, BatchNo, StockLocation, MfgDate, ExpDate, AbsRQty, QaStatus
      ) VALUES (
        :inwNo, :receiptItemId, :itemId, :batchNo, :stockLocation, ${mfgDateSql}, ${expDateSql}, :qty, '1'
      )
    `;
    await db.execute(sql, {
      inwNo,
      receiptItemId: batchData.receiptItemId,
      itemId: batchData.itemId,
      batchNo: batchData.batchNo,
      stockLocation: batchData.stockLocation,
      mfgDate: batchData.mfgDate,
      expDate: batchData.expDate,
      qty: batchData.qty
    }, { autoCommit: true });
  } else {
    const sql = `
      UPDATE tbfacilityreceiptbatches SET
        BatchNo = :batchNo,
        StockLocation = :stockLocation,
        MfgDate = ${mfgDateSql},
        ExpDate = ${expDateSql},
        AbsRQty = :qty
      WHERE InwNo = :inwNo
    `;
    await db.execute(sql, {
      batchNo: batchData.batchNo,
      stockLocation: batchData.stockLocation,
      mfgDate: batchData.mfgDate,
      expDate: batchData.expDate,
      qty: batchData.qty,
      inwNo
    }, { autoCommit: true });
  }
}

async function deleteReceiptBatch(inwNo) {
  const sql = `DELETE FROM tbfacilityreceiptbatches WHERE InwNo = :inwNo`;
  await db.execute(sql, { inwNo }, { autoCommit: true });
}

async function completeReceipt(receiptId, facilityId) {
  // Validate Item Batch Totals
  const chkSql = `
    SELECT 
      SUM(NVL(i.AbsrQty,0)) as "itemQty", 
      SUM(NVL(b.AbsRQty,0)) as "batchQty"
    FROM tbfacilityreceiptitems i
    LEFT JOIN tbfacilityreceiptbatches b ON b.FacReceiptItemID = i.FacReceiptItemID
    WHERE i.FacReceiptID = :receiptId
  `;
  const chkRes = await db.execute(chkSql, { receiptId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const itemQty = chkRes.rows[0].itemQty || chkRes.rows[0].ITEMQTY;
  const batchQty = chkRes.rows[0].batchQty || chkRes.rows[0].BATCHQTY;

  if (itemQty === 0 || itemQty !== batchQty) {
    throw new Error('Total batch quantity must match item receipt quantity.');
  }

  // Generate MRC
  const mrcSql = `
    SELECT b.FacilityCode as "facCode", 
           LPAD(NVL(MAX(TO_NUMBER(SUBSTR(a.MRCNumber, 8, 5))), 0) + 1, 5, '0') as "slno"
    FROM masfacilities b
    LEFT JOIN tbfacilityreceipts a ON a.FacilityID = b.FacilityID
    WHERE b.FacilityID = :facilityId
    GROUP BY b.FacilityCode
  `;
  const mrcRes = await db.execute(mrcSql, { facilityId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  const facCode = mrcRes.rows[0].facCode || mrcRes.rows[0].FACCODE;
  const slno = mrcRes.rows[0].slno || mrcRes.rows[0].SLNO;
  const mrcNumber = `LP-${facCode}${slno}`;

  const sql = `
    UPDATE tbfacilityreceipts SET
      Status = 'C',
      MRCNumber = :mrcNumber,
      MRCDate = SYSDATE
    WHERE FacReceiptID = :receiptId AND FacilityID = :facilityId
  `;
  await db.execute(sql, { mrcNumber, receiptId, facilityId }, { autoCommit: true });
  return mrcNumber;
}

async function completeSupplyOrder(poNoId, dispatchNo, dispatchDate) {
  let dateStr = null;
  if (dispatchDate) {
    const d = new Date(dispatchDate);
    if (!isNaN(d)) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      dateStr = `${day}-${month}-${year}`;
    }
  }

  const sql = `
    UPDATE LPsoOrderPlaced 
    SET STATUS = 'O', 
        DISPATCHNO = :dispatchNo, 
        DISPATCHDATE = TO_DATE(:dispatchDate, 'DD-MM-YYYY'),
        PODate = SYSDATE
    WHERE PONOID = :poNoId AND AmendNo = 0
  `;
  await db.execute(sql, {
    dispatchNo: dispatchNo || null,
    dispatchDate: dateStr,
    poNoId
  }, { autoCommit: true });
  
  return { success: true };
}

async function deleteSupplyOrder(poNoId) {
  // Try to delete child tables first
  const queries = [
    `Delete from LPsoOrderDistribution where OrderItemID in (Select OrderItemID from LPsoOrderedItems Where PoNoID = :poNoId)`,
    `Delete from LPsoWHDist where OrderItemID in (Select OrderItemID from LPsoOrderedItems Where PoNoID = :poNoId)`,
    `Delete from LPsoTranches where PoNoID = :poNoId`,
    `Delete from LPsoOrderedItems where PoNoID = :poNoId`,
    `Delete from LPsoOrderPlaced where PoNoID = :poNoId`
  ];
  
  for (let q of queries) {
    await db.execute(q, { poNoId }, { autoCommit: true });
  }
  return { success: true };
}

async function amendSupplyOrder(poNoId) {
  const queries = [
    `Insert into LPsoOrderPlaced_Amend (PONOID, ACCYRSETID, SOURCEID, SCHEMEID, CONTRACTID, SUPPLIERID, ORDERTYPE, PONO, PODATE, BUDGETRELEASEID, STATUS, ISSCHEDULELATER, ISQCPREDISPATCHED, SOISSUEDATE, SOValue, AMENDNO, AmendDate, PSAID) Select PONOID, ACCYRSETID, SOURCEID, SCHEMEID, CONTRACTID, SUPPLIERID, ORDERTYPE, PONO, PODATE, BUDGETRELEASEID, STATUS, ISSCHEDULELATER, ISQCPREDISPATCHED, SOISSUEDATE, SOValue, AMENDNO, AmendDate, PSAID from LPsoOrderPlaced Where PoNoID = :poNoId`,
    `Insert into LPsoOrderedItems_Amend (AMENDNO, ORDERITEMID, PONOID, ITEMID, SUPPLIERPACKQTY, UQTY, ABSQTY, SINGLEUNITPRICE, ITEMVALUE, RECEIPTABSQTY, ITEMSTATUS, SCHEDULECALCBY, CONTRACTITEMID, ADVINVOICEQTY, INVOICEQTY) Select b.AmendNo, a.ORDERITEMID, a.PONOID, a.ITEMID, a.SUPPLIERPACKQTY, a.UQTY, a.ABSQTY, a.SINGLEUNITPRICE, a.ITEMVALUE, a.RECEIPTABSQTY, a.ITEMSTATUS, a.SCHEDULECALCBY, a.CONTRACTITEMID, a.ADVINVOICEQTY, a.INVOICEQTY from LPsoOrderedItems a Inner Join LPsoOrderPlaced b on (b.PoNoID = a.PoNoID) Where b.PoNoID = :poNoId`,
    `Insert into LPsoTranches_Amend (AMENDNO, DURATIONID, PONOID, DURATION, DTYPE, EXPDATE, TRANCHE) Select b.AmendNo, a.DURATIONID, a.PONOID, a.DURATION, a.DTYPE, a.EXPDATE, a.TRANCHE from soTranches a Inner Join LPsoOrderPlaced b on (b.PoNoID = a.PoNoID) Where b.PoNoID = :poNoId`,
    `Insert into LPsoOrderDistribution_Amend (AMENDNO, ORDERDISTRIBUTIONID, ORDERITEMID, WAREHOUSEID, ABSQTY, RECEIPTABSQTY, REMARKS, DURATIONID) Select b.AmendNo, a1.ORDERDISTRIBUTIONID, a1.ORDERITEMID, a1.WAREHOUSEID, a1.ABSQTY, a1.RECEIPTABSQTY, a1.REMARKS, a1.DURATIONID from LPsoOrderDistribution a1 Inner Join LPsoOrderedItems a on (a.OrderItemID = a1.OrderItemID) Inner Join LPsoOrderPlaced b on (b.PoNoID = a.PoNoID) Where b.PoNoID = :poNoId`,
    `Insert into LPsoWHDist_Amend (AMENDNO, WHDISTID, ORDERITEMID, WAREHOUSEID, ABSQTY, RECEIPTABSQTY, INVOICEQTY, SUPPLIERRETURNQTY) Select b.AmendNo, a1.WHDISTID, a1.ORDERITEMID, a1.WAREHOUSEID, a1.ABSQTY, a1.RECEIPTABSQTY, a1.INVOICEQTY, a1.SUPPLIERRETURNQTY from LPsoWHDist a1 Inner Join LPsoOrderedItems a on (a.OrderItemID = a1.OrderItemID) Inner Join LPsoOrderPlaced b on (b.PoNoID = a.PoNoID) Where b.PoNoID = :poNoId`,
    `Update LPsoOrderPlaced set AmendNo = NVL(AmendNo, 0) + 1, AmendDate = sysdate, Status = 'I' Where PoNoID = :poNoId`
  ];

  for (let q of queries) {
    await db.execute(q, { poNoId }, { autoCommit: true });
  }
  return { success: true };
}

async function getNocDetails(facilityId, itemId) {
  const sql = `
    select distinct 
      to_char(nocdate, 'DD-MON-YYYY') || '-' || Nocnumber as "nocNumberStr", 
      mn.nocid as "nocId", 
      nocdate as "nocDate", 
      i.itemid as "itemId" 
    from mascgmscnoc mn 
    inner join mascgmscnocitems i on i.nocid=mn.nocid
    inner join masfacilities f on f.facilityid=mn.facilityid and f.isactive=1
    inner join masfacilitytypes ft  on ft.facilitytypeid=f.facilitytypeid
    where mn.status='C' 
      and mn.facilityid= :facilityId
      and (
        (case when ft.hodid=2 and mn.nocdate>'01-SEP-2024' then
          case when nvl(i.IsCGMSCAPR,'NA') ='Y' then 'Y' 
          else 
            case when nvl(i.IsCGMSCAPR,'NA')='N' then 'N' 
            else 
              case when nvl(i.IsCGMSCAPR,'NA')='NA' and sysdate>( nvl(CMHOAppliedDTTime,nocdate) + 48/24) then 'Y' 
              else 'NA' 
              end 
            end
          end 
        else 'Y' end) in ('N' ,'Y')
      )
      and (case when ft.hodid=2 then nvl(i.facreqqty,i.Approvedqty) else nvl(i.Approvedqty,0) end )>0
      and nocdate+220>sysdate
      and i.itemid= :itemId
    order by nocdate desc
  `;
  const result = await db.execute(sql, { facilityId, itemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows.map(r => ({
    nocNumberStr: r.nocNumberStr || r.NOCNUMBERSTR,
    nocId: r.nocId || r.NOCID,
    nocDate: r.nocDate || r.NOCDATE,
    itemId: r.itemId || r.ITEMID
  }));
}

async function getNocBalance(nocId, itemId) {
  const sql = `
    select 
      nvl(i.approvedqty,0)* m.unitcount as "approvedqty",
      nvl(opo.poqty,0) as "poqty",
      (nvl(i.approvedqty,0)* m.unitcount)-nvl(opo.poqty,0) as "BalQyy" 
    from mascgmscnoc mn 
    inner join mascgmscnocitems i on i.nocid=mn.nocid
    inner join masfacilities f on f.facilityid=mn.facilityid and f.isactive=1
    inner join masfacilitytypes ft on ft.facilitytypeid=f.facilitytypeid
    inner join vmasitems m on m.itemid=i.itemid 
    left outer join (
      select si.nocid, si.LPITEMID as ITEMID, ABSQTY as poqty 
      from LPsoOrderPlaced a   
      inner join LPsoOrderedItems si on si.PONOID=a.PONOID
      where a.status='O' and nocid is not null
    ) opo on opo.nocid=mn.nocid and opo.itemid=i.itemid
    where mn.status='C' 
      and i.nocid= :nocId
      and m.itemid= :itemId
      and (
        (case when ft.hodid=2 and mn.nocdate>'01-SEP-2024' then
          case when nvl(i.IsCGMSCAPR,'NA') ='Y' then 'Y' 
          else 
            case when nvl(i.IsCGMSCAPR,'NA')='N' then 'N' 
            else 
              case when nvl(i.IsCGMSCAPR,'NA')='NA' and sysdate>( nvl(CMHOAppliedDTTime,nocdate) + 48/24) then 'Y' 
              else 'NA' 
              end 
            end
          end 
        else 'Y' end) in ('N' ,'Y')
      )
  `;
  const result = await db.execute(sql, { nocId, itemId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  if (result.rows && result.rows.length > 0) {
    const r = result.rows[0];
    return {
      approvedqty: r.approvedqty || r.APPROVEDQTY,
      poqty: r.poqty || r.POQTY,
      balQyy: r.BalQyy || r.BALQYY
    };
  }
  return null;
}

module.exports = {
  getBudgets,
  getBudgetDetails,
  addBudgetDetail,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplyOrders,
  getSupplyOrderDetails,
  getSupplyOrderEditDetails,
  getSupplyOrderItems,
  addSupplyOrderItem,
  updateSupplyOrderItem,
  deleteSupplyOrderItem,
  generateSupplyOrderNo,
  saveSupplyOrderHeader,
  getSupplierReceipts,
  getReceiptHeaderData,
  saveReceiptHeader,
  getReceiptItems,
  saveReceiptItems,
  getReceiptBatches,
  saveReceiptBatch,
  deleteReceiptBatch,
  completeReceipt,
  completeSupplyOrder,
  deleteSupplyOrder,
  amendSupplyOrder,
  getNocDetails,
  getNocBalance
};
