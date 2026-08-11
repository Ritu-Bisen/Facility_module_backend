const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    const sql = `
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
    const res = await db.execute(sql, { poNoId: 97666 });
    console.log('Query successful, rows:', res.rows.length);
    console.log(res.rows);
  } catch (err) {
    console.error('SQL Error:', err.message);
  } finally {
    try { await db.close(); } catch(e){}
  }
}
test();
