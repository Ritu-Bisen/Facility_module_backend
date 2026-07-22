const db = require('../config/db');

async function getShortExpiryReport(facilityId, categoryId, itemId, monthFilter, isMonth) {
  let whereCondition = '';
  const binds = {};

  if (categoryId !== '0') {
    whereCondition += ' and Item.CategoryID = :categoryId';
    binds.categoryId = categoryId;
  }
  if (itemId !== '0') {
    whereCondition += ' and a2.ItemID = :itemId';
    binds.itemId = itemId;
  }

  let havingClause = '';
  if (isMonth) {
    if (monthFilter !== '0') {
      whereCondition += " and to_char(a2.ExpDate,'Mon-YYYY') = :monthFilter";
      binds.monthFilter = monthFilter;
    }
    havingClause = " Having to_char(a2.ExpDate,'dd-Mon-YYYY') < trunc(Sysdate) or to_char(a2.ExpDate,'dd-Mon-YYYY') Between trunc(sysdate) and Add_Months(trunc(SysDate),6) ";
  } else {
    let min = '0';
    let max = '2';
    switch (monthFilter) {
      case '0 - 3': min = '0'; max = '2'; break;
      case '4 - 6': min = '4'; max = '6'; break;
      case '7 - 10': min = '7'; max = '10'; break;
      case '11 - 12': min = '11'; max = '12'; break;
    }
    havingClause = ` Having MONTHS_BETWEEN(a2.expdate,sysdate) < ${max} and MONTHS_BETWEEN(a2.expdate,sysdate) > ${min} `;
  }

  const sql = `
    Select 
      Cat.CategoryID, 
      Cat.CategoryName, 
      a2.ItemID, 
      a2.BatchNo, 
      a2.MdgDate, 
      a2.ExpDate, 
      (sum(NVL(a2.AbsRQty, 0)) - sum(NVL(a2.IssueQty, 0))) as CurBal, 
      sum(NVL(a2.AllotQty,0)) - sum(NVL(a2.IssueQty,0)) ReservedQty 
    from tbFacilityReceipts a1 
    inner join tbFacilityReceiptItems a2 on (a2.FacReceiptID = a1.FacReceiptID) 
    inner join masitems Item on (Item.ItemID = a2.ItemID) 
    inner join masitemcategories Cat on (Cat.CategoryID = Item.CategoryID) 
    Where NVL(a2.AbsRQty, 0) - NVL(a2.IssueQty, 0) > 0 and a2.ExpDate is not null 
    ${whereCondition} 
    Group by a2.ItemID,a2.expdate,a2.MdgDate,Cat.CategoryID,Cat.CategoryName,a2.batchNo 
    ${havingClause} 
    Order By a2.ExpDate
  `;

  const result = await db.execute(sql, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

module.exports = {
  getShortExpiryReport
};
