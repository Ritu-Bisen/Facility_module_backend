const db = require('../config/db');
const oracledb = require('oracledb');

async function getStockRegister(facilityId, itemId, fromDate) {
  try {
    // fromDate comes from frontend as 'YYYY-MM-DD' (e.g. '2026-04-01').
    // Oracle raw string interpolation expects 'DD-MON-YYYY' (e.g. '01-APR-2026') for implicit date casting.
    const dateObj = new Date(fromDate);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedFromDate = `${String(dateObj.getDate()).padStart(2, '0')}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;

    // Using exactly the provided query with template literals for the variables
    const query = `
select
 dt,Type1,Type,TranDate,QTY,TranType,Place,TRANNO,receiptitemid
 from 
 (
    select  sysdate AS dt ,0 as Type1,'OP' as Type,to_char('${formattedFromDate}') as  TranDate,sum((case when b.qastatus = '1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end)) QTY,'OP' as TranType,'Opening Stock' as Place,'Opening Balance' TRANNO,0 as receiptitemid
   from tbfacilityreceiptbatches b
   inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid
   inner join tbfacilityreceipts t on t.facreceiptid= i.facreceiptid
   inner join masitems mi on mi.itemid= i.itemid
   left outer join
   (
     select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) issueqty
       from tbfacilityissues fs
     inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid
     inner join tbfacilityoutwards ftbo on ftbo.issueitemid= fsi.issueitemid
     where fs.status = 'C'  and fs.facilityid=${facilityId}  and fs.issuedate<'${formattedFromDate}'
     and fsi.itemid=${itemId}
     group by fsi.itemid, fs.facilityid, ftbo.inwno
   ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid
   Where  T.Status = 'C'  And(b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate>sysdate
  and t.facilityid= ${facilityId} and i.itemid=${itemId} and t.FACRECEIPTDATE<'${formattedFromDate}'
  having (sum((case when b.qastatus = '1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end)))>0
 union all
 
 select fs.issuedate dt,2 as Type1, 'Issue' as Type,to_char(fs.issuedate,'dd-MM-yyyy') as TranDate,sum(nvl(ftbo.issueqty,0)) QTY,fs.issuetype as TranType,case when wr.wardname is null then f2.facilityname else wr.wardname end as Place,fs.ISSUENO as TRANNO,0 as receiptitemid
   from tbfacilityissues fs
left outer join  masfacilitywards wr on wr.wardid=fs.wardid
left outer join masfacilities f2 on f2.facilityid=fs.tofacilityid
 inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid
 inner join tbfacilityoutwards ftbo on ftbo.issueitemid= fsi.issueitemid
 where fs.status = 'C'  and fs.facilityid=${facilityId} and fsi.itemid=${itemId}
 and fs.issuedate>='${formattedFromDate}'
 group by fs.issuedate,fs.issuetype,wr.wardname,f2.facilityname,fs.ISSUENO
 
 union all   

 select  t.FACRECEIPTDATE as dt,1 as Type1 ,Case when t.FACRECEIPTTYPE = 'FC' then 'Opening Stock' else 'Receipt' end as Type,to_char(t.FACRECEIPTDATE,'dd-MM-yyyy') as TranDate, sum((case when b.qastatus = '1' then (nvl(b.absrqty,0)) else 0 end)) QTY,t.FACRECEIPTTYPE as  TranType,
    Case when t.FACRECEIPTTYPE = 'FC' then 'Opening' else  case when  f2.facilityname is  null then 'WH:'||w.warehousename else f2.facilityname end end as  Place, t.FACRECEIPTNO AS TRANNO,i.facreceiptitemid as receiptitemid 
   from tbfacilityreceiptbatches b
   inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid
      inner join masitems mi on mi.itemid= i.itemid
   inner join tbfacilityreceipts t on t.facreceiptid= i.facreceiptid
   left outer join maswarehouses w on w.warehouseid=t.warehouseid
left outer join masfacilities f2 on f2.facilityid=t.TOFACILITYID
     Where  T.Status = 'C'  And(b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate>sysdate
   and t.facilityid= ${facilityId} and i.itemid=${itemId} and t.FACRECEIPTDATE>='${formattedFromDate}' 
 group by t.FACRECEIPTDATE,t.FACRECEIPTTYPE,w.warehousename,f2.facilityname,t.FACRECEIPTNO,i.facreceiptitemid ,t.status

 ) ab
order by dt,Type1
    `;

    const result = await db.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;

  } catch (error) {
    console.error('Error fetching stock register:', error);
    throw error;
  }
}

// Function to get items available in facility for dropdown selection
async function getFacilityItems(facilityId) {
  try {
    const query = `
      select distinct mi.itemid, mi.itemcode || ' - ' || mi.itemname as itemname
      from masitems mi
      inner join tbfacilityreceiptitems i on mi.itemid = i.itemid
      inner join tbfacilityreceipts t on t.facreceiptid = i.facreceiptid
      where t.facilityid = :facilityId
      order by itemname
    `;
    const result = await db.execute(query, [facilityId], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching facility items:', error);
    throw error;
  }
}

module.exports = {
  getStockRegister,
  getFacilityItems
};
