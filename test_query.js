const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    
    // Let's test the query with the exact columns we expect
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
        o.NOCID as "nocDetail",
        m.Strength as "mStrength",
        mi.STRENGTH1 as "miStrength",
        m.Unit as "mUnit",
        mi.UNIT as "miUnit",
        ci.MANUFACTURER as "manufacturer",
        ci.BASICRATE as "basicRate",
        ci.PERCENTVALUEGST as "gst"
      FROM LPsoOrderedItems o
      INNER JOIN LPsoOrderPlaced op ON o.PoNoID = op.PoNoID
      LEFT JOIN LPContractItems ci ON op.ContractID = ci.ContractID 
        AND (
          (o.LPItemID IS NOT NULL AND ci.LPItemID = o.LPItemID)
          OR (o.ItemID IS NOT NULL AND ci.ItemID = o.ItemID)
        )
      LEFT JOIN LPMasItems m ON m.LPItemID = COALESCE(o.LPItemID, ci.LPItemID)
      LEFT JOIN MasItems mi ON mi.ItemID = COALESCE(o.ItemID, ci.ItemID)
      WHERE o.PoNoID = :poNoId
      ORDER BY o.OrderItemID
    `;
    const res = await db.execute(sql, { poNoId: 98991 });
    console.log('Query successful, rows:', res.rows.length);
    console.log(res.rows);
  } catch (err) {
    console.error('SQL Error:', err.message);
  } finally {
    try { await db.close(); } catch(e){}
  }
}
test();
