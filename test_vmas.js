const db = require('./src/config/db');
require('dotenv').config();

async function test() {
  try {
    await db.initialize();
    const querySql = `
      SELECT 
        o.OrderItemID as "orderItemId",
        o.ItemID as "itemId",
        o.LPItemID as "lpItemId",
        COALESCE(v.ItemName, o.ItemName) as "itemName",
        v.ItemCode as "itemCode",
        NVL(o.AbsQty,0) as "orderQty",
        NVL(o.SINGLEUNITPRICE,0) as "unitPrice",
        o.ITEMVALUE as "amount",
        o.NOCID as "nocDetail",
        v.STRENGTH1 as "strength",
        v.UNIT as "unit",
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
      LEFT JOIN VMASITEMS v ON v.ItemID = COALESCE(o.LPItemID, o.ItemID, ci.LPItemID, ci.ItemID)
      WHERE o.PoNoID = :poNoId
      ORDER BY o.OrderItemID
    `;
    const runRes = await db.execute(querySql, { poNoId: 99161 });
    console.log('Run results:', runRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
test();
