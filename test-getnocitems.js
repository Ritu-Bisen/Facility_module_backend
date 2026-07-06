require('dotenv').config();
const db = require('./src/config/db');

async function test() {
  try {
    await db.initialize();
    const nocId = 335831;
    const query = `
    SELECT
      b.SR as NOCITEMID,
      b.NOCID,
      b.ITEMID,
      m.ITEMCODE,
      m.ITEMNAME,
      m.STRENGTH1,
      m.UNIT,
      b.REQUESTEDQTY,
      b.WHSTOCK,
      NVL(b.BOOKEDQTY, 0)   AS BOOKEDQTY,
      NVL(b.APPROVEDQTY, 0) AS APPROVEDQTY,
      NVL(b.STOCKINHAND, 0) AS STOCKINHAND,
      b.ITEMREMARKS as REMARKS
    FROM MASCGMSCNOCITEMS b
    INNER JOIN MASITEMS m ON m.ITEMID = b.ITEMID
    WHERE b.NOCID = :nocId
    ORDER BY b.SR
  `;
    const result = await db.execute(query, { nocId }, { outFormat: 4002 /* oracledb.OUT_FORMAT_OBJECT */ });
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

test();
