const db = require('../src/config/db');
const oracledb = require('oracledb');

async function testFullDownloadQuery(catId, facId = 22595) {
  try {
    await db.initialize();

    console.log(`\n=== FULL DOWNLOAD QUERY FOR catId=${catId}, facId=${facId} ===`);

    // 1. Resolve category ID
    let realCatId = Number(catId) || 0;
    if (realCatId > 0) {
      const subRes = await db.execute(
        `select categoryid from massubitemcategory where subcatid = :realCatId`,
        { realCatId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (subRes.rows && subRes.rows.length > 0) {
        realCatId = Number(subRes.rows[0].CATEGORYID || subRes.rows[0].categoryid);
        console.log(`Mapped subcatid ${catId} -> realCatId ${realCatId}`);
      }
    }

    const binds = { facId };
    let categoryClause = '';
    if (realCatId > 0) {
      categoryClause = ' and mt.categoryid = :realCatId ';
      binds.realCatId = realCatId;
    }

    const query = `
      select 0 SlNo, Formate.itemcode, substr(Formate.itemname,1,100) as itemname, Formate.Formulation, substr(Formate.Strength,1,100) Strength, Formate.GroupName,
             Formate.edl, nvl(iss.FacIssueqty,0) as COSUMPTION, nvl(cr.CurStock,0) as Current_Stock, 0 as INDENT_26_27, 
             nvl(vr.singlerate,0) as Rate, Formate.PACKAGINGUNIT, Formate.categoryname 
      from (
          select 0 SlNo, m.itemcode, m.ItemID, case when length(m.itemname)>100 then substr(m.itemname,0,100) else itemname end itemname, 
                 t.itemtypename Formulation, case when length(m.strength1)>100 then substr(m.strength1,0,100) else m.strength1 end Strength, 
                 g.groupname GroupName, nvl(e.edl, 'EDL') as edl, 0 COSUMPTION_From_1APR_24, 0 Current_Stock, 0 INDENT_25_26, m.isedl2021, mt.categoryname,
                 nvl(m.packingqty, nvl(m.unitcount, 1)) as PACKAGINGUNIT,
                 case when isedl2021='Y' then 'Yes' else 'No' end as EDL2021, case when EDL2025='Y' then 'Yes' else 'No' end as EDL2025,
                 case when (edl2025flag='COMMON' or edl2025flag='DHS') then 'Yes' else 'No' end as IsIPHS, mc.mcid
          from masitems m 
          inner join masitemgroups g on m.groupid=g.groupid  
          inner join masitemcategories mt on mt.categoryid=m.categoryid 
          left outer join masitemmaincategory mc on mc.MCID=mt.MCID
          left outer join masedl e on e.edlcat=m.edlcat 
          left outer join masitemtypes t on t.itemtypeid=m.itemtypeid
          where m.isfreez_itpr is null 
            ${categoryClause}
      ) Formate
      left outer join v_itemrate vr on vr.itemid=Formate.itemid
      left outer join (
          select ii.itemid, sum(tbo.issueqty) as FacIssueqty 
          from tbfacilityissues i
          inner join tbfacilityissueitems ii on ii.issueid=i.issueid
          inner join tbfacilityoutwards tbo on tbo.issueitemid=ii.issueitemid
          where i.status='C' and i.facilityid = :facId
          group by ii.itemid
      ) iss on iss.itemid=Formate.ItemID
      left outer join (
          select itemid, sum(ReadyForIssue) as CurStock 
          from (
              select b.batchno, b.expdate, b.inwno, t.facilityid, i.itemid, 
                     (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) ReadyForIssue  
              from tbfacilityreceiptbatches b   
              inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid 
              inner join tbfacilityreceipts t on t.facreceiptid=i.facreceiptid                  
              left outer join (  
                  select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) issueqty   
                  from tbfacilityissues fs 
                  inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid 
                  inner join tbfacilityoutwards ftbo on ftbo.issueitemid=fsi.issueitemid 
                  where fs.status = 'C' and fs.facilityid = :facId
                  group by fsi.itemid, fs.facilityid, ftbo.inwno                     
              ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid                 
              Where T.Status = 'C' And (b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate > sysdate 
                and t.facilityid = :facId
          ) group by itemid having sum(ReadyForIssue) > 0
      ) cr on cr.itemid=Formate.ItemID
      order by groupname, itemname
    `;

    const res = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log(`Returned rows count: ${res.rows ? res.rows.length : 0}`);
    if (res.rows && res.rows.length > 0) {
      console.log("Sample Row:", res.rows[0]);
    }

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

testFullDownloadQuery(1);
