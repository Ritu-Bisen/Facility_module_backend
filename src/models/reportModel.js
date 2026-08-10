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

async function getHoldBatchesReport(facilityId, itemTypeId) {
  let whereClause = '';
  const binds = { facilityId };

  if (itemTypeId && itemTypeId !== '0') {
    whereClause = 'and mt.itemtypeid = :itemTypeId';
    binds.itemTypeId = itemTypeId;
  }

  const sql = `
    select 
      A.batchno as "batchNo",
      to_char(A.expdate,'dd-mm-yy') as "expDate",
      A.itemcode as "itemCode",
      A.ItemName || '-' || A.strength1 as "itemName", 
      A.SKU as "sku",
      (case when sum(A.ReadyForIssue) > 0 then sum(A.ReadyForIssue) else 0 end) as "readyForIssue",
      (case when sum(nvl(A.Pending,0)) > 0 then sum(nvl(A.Pending,0)) else 0 end) as "pending",
      facilityname as "facilityName",
      mc.CategoryName as "categoryName",
      mc.CategoryID as "categoryId",
      mt.itemtypename as "itemTypeName",
      whissueblock as "holdStatus"
    from (
      select 
        b.batchno,
        b.expdate,
        f.facilityname,
        mi.ITEMCODE, 
        b.inwno,
        mi.ITEMNAME, 
        mi.strength1,
        mi.unit as SKU,
        t.facilityid, 
        mi.itemid,
        (nvl(b.absrqty,0) - nvl(iq.issueqty,0) ) as ReadyForIssue,
        (case when b.qastatus = 0 or b.qastatus = 3 then (nvl(b.absrqty,0)- nvl(iq.issueqty,0)) end) Pending,
        case when b.whissueblock=1 then 'Hold' else 'Unhold' end whissueblock   
      from tbfacilityreceiptbatches b   
      inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid 
      inner join tbfacilityreceipts t on t.facreceiptid=i.facreceiptid  
      inner join vmasitems mi on mi.itemid=i.itemid 
      inner join masfacilities f on f.facilityid=t.facilityid 
      left outer join (  
        select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) issueqty   
        from tbfacilityissues fs 
        inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid 
        inner join tbfacilityoutwards ftbo on ftbo.issueitemid=fsi.issueitemid 
        where fs.status = 'C'                 
        group by fsi.itemid,fs.facilityid,ftbo.inwno                     
      ) iq on b.inwno = iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid                 
      Where T.Status = 'C' And (b.Whissueblock = 1 OR b.QAstatus = 2) and b.expdate > sysdate 
      and t.facilityid = :facilityId
    ) A 
    inner join vmasitems mia on mia.itemid=A.itemid  
    left outer join masitemtypes mt on mt.itemtypeid=mia.itemtypeid  
    inner join masitemcategories mc on mc.CategoryID=mia.CategoryID  
    where A.facilityid = :facilityId ${whereClause}
    group by whissueblock, mt.itemtypename, facilityname, A.itemcode, A.ItemName, A.strength1, A.SKU, mc.CategoryID, mc.CategoryName, A.batchno, A.expdate  
    having sum(nvl(A.ReadyForIssue,0)) > 0 or sum(nvl(A.Pending,0)) > 0 
    order by A.itemcode 
  `;

  const result = await db.execute(sql, binds, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  
  return result.rows.map((r, index) => ({
    slNo: index + 1,
    facilityName: r.facilityName || r.FACILITYNAME,
    drugCode: r.itemCode || r.ITEMCODE,
    drugName: r.itemName || r.ITEMNAME,
    unit: r.sku || r.SKU,
    itemType: r.itemTypeName || r.ITEMTYPENAME || 'OTHER',
    availableStock: r.readyForIssue !== undefined ? r.readyForIssue : r.READYFORISSUE,
    batchNo: r.batchNo || r.BATCHNO,
    expiryDate: r.expDate || r.EXPDATE,
    categoryName: r.categoryName || r.CATEGORYNAME,
    holdStatus: r.holdStatus || r.HOLDSTATUS
  }));
}

module.exports = {
  getShortExpiryReport,
  getHoldBatchesReport
};
