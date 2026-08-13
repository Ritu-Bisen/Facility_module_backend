const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    
    // Find the PoNoID for '23393-LP00076/26-27'
    const poRes = await db.execute(`
      SELECT PoNoID, PoNo, ContractID FROM LPsoOrderPlaced WHERE PoNo = '23393-LP00076/26-27'
    `, {}, { outFormat: 4002 });
    console.log('PO:', poRes.rows);
    
    if (poRes.rows.length > 0) {
      const poNoId = poRes.rows[0].PONOID;
      
      // Get all items in this PO
      const itemsRes = await db.execute(`
        SELECT * FROM LPsoOrderedItems WHERE PoNoID = :poNoId
      `, { poNoId }, { outFormat: 4002 });
      console.log('Items:', itemsRes.rows);
      
      // Let's run our getSupplyOrderItems query for this PO
      const querySql = `
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
          COALESCE(m.Strength, mi.STRENGTH1) as "strength",
          COALESCE(m.Unit, mi.UNIT) as "unit",
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
      const runRes = await db.execute(querySql, { poNoId });
      console.log('Run results:', runRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
test();
