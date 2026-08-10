const db = require('../config/db');
const oracledb = require('oracledb');

async function getCurrentStockDrugWise(facilityId, itemId, stockStatus) {
}

async function getCurrentStockBatchWise(facilityId, itemTypeId) {
    let itemTypeFilter = '';
    const params = { facilityId };
    
    // Support treating '0' or empty as 'all'
    if (itemTypeId && itemTypeId !== '0') {
        itemTypeFilter = ' AND mt.itemtypeid = :itemTypeId ';
        params.itemTypeId = itemTypeId;
    }

    const query = `
        SELECT DISTINCT 0 as SlNo, A.batchno, TO_CHAR(A.expdate, 'dd-mm-yy') AS expdate,
               A.itemcode AS ITEMCODE, A.ItemName || '-' || A.strength1 AS ItemName, 
               A.SKU, A.STOCKLOCATION,
               (CASE WHEN SUM(A.ReadyForIssue) > 0 THEN SUM(A.ReadyForIssue) ELSE 0 END) AS ReadyForIssue,
               (CASE WHEN SUM(NVL(Pending, 0)) > 0 THEN SUM(NVL(Pending, 0)) ELSE 0 END) Pending,
               facilityname, mc.CategoryName, mc.CategoryID, mt.itemtypename
        FROM
          (
            SELECT b.batchno, b.expdate, f.facilityname, mi.ITEMCODE, b.inwno, 
                   mi.ITEMNAME, mi.strength1, mi.unit AS SKU, t.facilityid, mi.itemid,
                   NVL(mr.locationno,'0') AS STOCKLOCATION,
                   (CASE WHEN b.qastatus = '1' THEN (NVL(b.absrqty, 0) - NVL(iq.issueqty, 0)) END) ReadyForIssue,
                   (CASE WHEN b.qastatus = '0' OR b.qastatus = '3' THEN (NVL(b.absrqty, 0) - NVL(iq.issueqty, 0)) END) Pending
            FROM tbfacilityreceiptbatches b
            LEFT JOIN masracks mr ON mr.rackid = b.StockLocation
            INNER JOIN tbfacilityreceiptitems i ON b.facreceiptitemid = i.facreceiptitemid
            INNER JOIN tbfacilityreceipts t ON t.facreceiptid = i.facreceiptid
            INNER JOIN vmasitems mi ON mi.itemid = i.itemid
            INNER JOIN masfacilities f ON f.facilityid = t.facilityid
            LEFT OUTER JOIN
              (
                SELECT fs.facilityid, fsi.itemid, ftbo.inwno, SUM(NVL(ftbo.issueqty, 0)) issueqty
                FROM tbfacilityissues fs
                INNER JOIN tbfacilityissueitems fsi ON fsi.issueid = fs.issueid
                INNER JOIN tbfacilityoutwards ftbo ON ftbo.issueitemid = fsi.issueitemid
                WHERE fs.status = 'C'
                GROUP BY fsi.itemid, fs.facilityid, ftbo.inwno
              ) iq ON b.inwno = iq.inwno 
                       AND iq.itemid = i.itemid 
                       AND iq.facilityid = t.facilityid
            WHERE t.Status = 'C' 
              AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
              AND b.expdate > SYSDATE
              AND t.facilityid = :facilityId
          ) A
        INNER JOIN vmasitems mia ON mia.itemid = A.itemid
        LEFT OUTER JOIN masitemtypes mt ON mt.itemtypeid = mia.itemtypeid
        INNER JOIN masitemcategories mc ON mc.CategoryID = mia.CategoryID
        WHERE A.facilityid = :facilityId 
          ${itemTypeFilter}
        GROUP BY mt.itemtypename, facilityname, A.itemcode, A.ItemName, A.strength1, A.SKU, A.STOCKLOCATION,
                 mc.CategoryID, mc.CategoryName, A.batchno, A.expdate
        HAVING SUM(NVL(A.ReadyForIssue, 0)) > 0 OR SUM(NVL(A.Pending, 0)) > 0
        ORDER BY A.itemcode
    `;

    const result = await db.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
}

async function getFacilityStockDrugWise(facilityId) {
    // Batch-level detail query (for Facility Stock - Drug Wise page with filters)
    const query = `
        select d.districtname,f.facilityname,mc.mcategory,ty.itemtypename,mi.ITEMCODE as uniqueitemcode,mi.ITEMNAME,mi.strength1 ,mi.unit,  b.batchno,b.MFGDATE,b.expdate
           ,to_char(b.MFGDATE,'dd-MM-yy') as MFGDATEddmmyy,to_char(b.expdate,'dd-MM-yy') as expdateddmmyy
           ,round(b.expdate-sysdate,0) as DaysTobeExpired
           ,case when round(b.expdate-sysdate,0)<=90 then '<=90 days' 
                 when round(b.expdate-sysdate,0)>90  and round(b.expdate-sysdate,0)<=180 then '91\u201380 days' 
                 when round(b.expdate-sysdate,0)>180  and round(b.expdate-sysdate,0)<=270  then '181\u2013270 days' 
                 when round(b.expdate-sysdate,0)>270  and round(b.expdate-sysdate,0)<=365  then '270\u2013365 days' 
                 when round(b.expdate-sysdate,0)>365 then '>365 days' end  as ExpDaysStatus,
           (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) BatchStock
           ,nvl(ReservQty,0) as  ReservQty,r.LOCATIONNO
           , b.inwno,t.facilityid, mi.itemid as uniqueitemid,d.districtid,mc.mcid,mi.unitcount
           ,w.warehouseid,w.warehousename
           ,ft.facilitytypeid,ft.facilitytypecode,ft.uniqustats,
           mvm.EDL2025FLAG,mvm.CGMSCFMFLAG,mvm.CGMSCFMCNT,mvm.EDLTYPE2025,mvm.DH,mvm.CHC_CH,mvm.PHC,mvm.SHC,mvm.GROUPNAME
           ,u.emailid,u.userid, fh.FOOTER1 as Storeincharge ,fh.FOOTER2 as StoreInchargename,fh.FOOTER3 as StoreinchargeMobile,fh.DRMOBILE,fh.DRNAME as facemail
           ,case when mi.EDLITEMCODE is not null then edlitemcode else mi.itemcode end as ITEMCODE
           ,case when mi.EDLITEMCODE is not null then mvm.itemid else 0 end as itemid
        from tbfacilityreceiptbatches b   
        inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid 
        inner join tbfacilityreceipts t on t.facreceiptid=i.facreceiptid  
        inner join vmasitems mi on mi.itemid=i.itemid 
        left outer join masitemtypes ty on ty.ITEMTYPEID=mi.ITEMTYPEID
        left outer join  masitemcategories c on c.categoryid=mi.categoryid
        left outer join  masitemmaincategory mc on mc.mcid=c.mcid
        inner join masfacilities f  on f.facilityid=t.facilityid 
        left outer join usrusers u on u.facilityid=f.facilityid
        left outer join masfacheaderfooter fh on fh.userid=u.userid
        left outer join masracks r on r.rackid=b.stocklocation and r.WAREHOUSEID=f.facilityid
        inner join masdistricts d on d.districtid=f.districtid
        inner join maswarehouses w on w.warehouseid=d.warehouseid
        inner join masfacilitytypes ft on ft.facilitytypeid=f.facilitytypeid
        left outer join mv_masitems mvm on mvm.itemcode=mi.EDLITEMCODE
        left outer join 
        (  
            select  fs.facilityid,fsi.itemid,ftbo.inwno,sum(nvl(ftbo.issueqty,0)) issueqty   
            from tbfacilityissues fs 
            inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid 
            inner join tbfacilityoutwards ftbo on ftbo.issueitemid=fsi.issueitemid 
            where fs.status = 'C'                 
            group by fsi.itemid,fs.facilityid,ftbo.inwno                     
        ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid 
        left outer join
        (
            select fs.facilityid,fsi.itemid,fso.inwno,sum(nvl(fso.issueqty,0))  as ReservQty from tbfacilityissues fs
            inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid
            inner join tbfacilityoutwards fso on fso.issueitemid=fsi.issueitemid
            where  fs.status='IN' group by fsi.itemid,fs.facilityid,fso.inwno                     
        )resv on resv.inwno=b.inwno and resv.facilityid= f.facilityid
        Where  T.Status = 'C'  And (b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate>sysdate 
        and  f.facilityid=:facilityId
        and (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end)>0
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
}

async function getFacilityStockItemWise(facilityId) {
    // Item-grouped query: sums BatchStock and ReservQty per unique item (no batch columns)
    const query = `
        select 
           d.districtname, f.facilityname, mc.mcategory, ty.itemtypename,
           mi.ITEMCODE as uniqueitemcode, mi.ITEMNAME, mi.strength1, mi.unit,
           w.warehouseid, w.warehousename,
           ft.facilitytypeid, ft.facilitytypecode, ft.uniqustats,
           mvm.EDL2025FLAG, mvm.CGMSCFMFLAG, mvm.CGMSCFMCNT, mvm.EDLTYPE2025,
           mvm.DH, mvm.CHC_CH, mvm.PHC, mvm.SHC, mvm.GROUPNAME,
           t.facilityid, mi.itemid as uniqueitemid, d.districtid, mc.mcid, mi.unitcount,
           case when mi.EDLITEMCODE is not null then edlitemcode else mi.itemcode end as ITEMCODE,
           case when mi.EDLITEMCODE is not null then mvm.itemid else 0 end as itemid,
           sum(case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) else 0 end) as BatchStock,
           sum(nvl(resv.ReservQty,0)) as ReservQty
        from tbfacilityreceiptbatches b   
        inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid 
        inner join tbfacilityreceipts t on t.facreceiptid=i.facreceiptid  
        inner join vmasitems mi on mi.itemid=i.itemid 
        left outer join masitemtypes ty on ty.ITEMTYPEID=mi.ITEMTYPEID
        left outer join masitemcategories c on c.categoryid=mi.categoryid
        left outer join masitemmaincategory mc on mc.mcid=c.mcid
        inner join masfacilities f on f.facilityid=t.facilityid 
        inner join masdistricts d on d.districtid=f.districtid
        inner join maswarehouses w on w.warehouseid=d.warehouseid
        inner join masfacilitytypes ft on ft.facilitytypeid=f.facilitytypeid
        left outer join mv_masitems mvm on mvm.itemcode=mi.EDLITEMCODE
        left outer join 
        (  
            select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) issueqty   
            from tbfacilityissues fs 
            inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid 
            inner join tbfacilityoutwards ftbo on ftbo.issueitemid=fsi.issueitemid 
            where fs.status = 'C'                 
            group by fsi.itemid, fs.facilityid, ftbo.inwno                     
        ) iq on b.inwno = iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid 
        left outer join
        (
            select fs.facilityid, fsi.itemid, sum(nvl(fso.issueqty,0)) as ReservQty 
            from tbfacilityissues fs
            inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid
            inner join tbfacilityoutwards fso on fso.issueitemid=fsi.issueitemid
            where fs.status='IN' 
            group by fsi.itemid, fs.facilityid                     
        ) resv on resv.facilityid=t.facilityid and resv.itemid=i.itemid
        Where T.Status = 'C' And (b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate>sysdate 
        and f.facilityid=:facilityId
        group by 
           d.districtname, f.facilityname, mc.mcategory, ty.itemtypename,
           mi.ITEMCODE, mi.ITEMNAME, mi.strength1, mi.unit,
           w.warehouseid, w.warehousename,
           ft.facilitytypeid, ft.facilitytypecode, ft.uniqustats,
           mvm.EDL2025FLAG, mvm.CGMSCFMFLAG, mvm.CGMSCFMCNT, mvm.EDLTYPE2025,
           mvm.DH, mvm.CHC_CH, mvm.PHC, mvm.SHC, mvm.GROUPNAME,
           t.facilityid, mi.itemid, d.districtid, mc.mcid, mi.unitcount,
           case when mi.EDLITEMCODE is not null then edlitemcode else mi.itemcode end,
           case when mi.EDLITEMCODE is not null then mvm.itemid else 0 end
        having sum(case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) else 0 end) > 0
        order by mi.ITEMNAME
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
}

async function getWarehouseStock(facilityId) {
    // Fetch warehouse ID for this facility
    const whQuery = `
        select w.warehouseid 
        from masfacilities f
        inner join masdistricts d on d.districtid=f.districtid
        inner join maswarehouses w on w.warehouseid=d.warehouseid
        where f.facilityid = :facilityId
    `;
    const whResult = await db.execute(whQuery, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (!whResult.rows || whResult.rows.length === 0) {
        throw new Error("Warehouse not found for this facility");
    }
    const warehouseId = whResult.rows[0].WAREHOUSEID || whResult.rows[0].warehouseid;

    const query = `
        select WAREHOUSENAME,WAREHOUSEID,MCATEGORY,MCID,EDLTYPE,PROGRAM,PROGRAMITEMS,AISTATUS,
        ITEMNAME,ITEMCODE,STRENGTH1,UNIT,l.ITEMID,UNITCOUNT,l.edl,l.RECEIPTDATEWH,l.QCPASSEDDT
        ,READYQTY*nvl(UNITCOUNT,1) as READYQTY,NEAREXPQTY3MONTH *nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH,UQQTY*nvl(UNITCOUNT,1) as UQQTY,IWHPIPQTY*nvl(UNITCOUNT,1) as IWHPIPQTY,PIPELINEQTY*nvl(UNITCOUNT,1) as PIPELINEQTY,QCPASSEDDT,RECEIPTDATEATWAREHOUSE,CGMSCFM,GROUPNAME,ITEMTYPENAME
        ,ABCCATEGORY,VEDCATEGORY,nvl(facstock.itemstock,0) as FACILITYSTOCK
        from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l
         left outer join masedl e on e.edl=l.edl
         
left outer join (  
  select itemid , sum(batchstock) as itemstock from (
  select  b.batchno,
           (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) BatchStock
           , b.inwno
           ,case when mi.EDLITEMCODE is not null then edlitemcode else mi.itemcode end as ITEMCODE
           ,case when mi.EDLITEMCODE is not null then mvm.itemid else 0 end as itemid
        from tbfacilityreceiptbatches b   
        inner join tbfacilityreceiptitems i on b.facreceiptitemid=i.facreceiptitemid 
        inner join tbfacilityreceipts t on t.facreceiptid=i.facreceiptid  
        inner join vmasitems mi on mi.itemid=i.itemid   
        inner join masfacilities f  on f.facilityid=t.facilityid and f.facilityid=:facilityId
        inner join mv_masitems mvm on mvm.itemcode=mi.EDLITEMCODE
        left outer join 
        (  
            select  fs.facilityid,fsi.itemid,ftbo.inwno,sum(nvl(ftbo.issueqty,0)) issueqty   
            from tbfacilityissues fs 
            inner join tbfacilityissueitems fsi on fsi.issueid=fs.issueid 
            inner join tbfacilityoutwards ftbo on ftbo.issueitemid=fsi.issueitemid 
            where fs.status = 'C'  and fs.facilityid=:facilityId               
            group by fsi.itemid,fs.facilityid,ftbo.inwno                     
        ) iq on b.inwno = Iq.inwno and iq.itemid=i.itemid and iq.facilityid=t.facilityid 

       
        Where  T.Status = 'C'  And (b.Whissueblock = 0 or b.Whissueblock is null) and b.expdate>sysdate 
        and  f.facilityid=:facilityId
        and (case when b.qastatus ='1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end)>0) group by itemid
        
          ) facstock on facstock.itemid=l.itemid

        where mcid=1
        and WAREHOUSEID=:warehouseId
        and (nvl(READYQTY,0)+nvl(UQQTY,0)+nvl(IWHPIPQTY,0) +nvl(PIPELINEQTY,0))>0
        and e.edlcat<= (select eldcat from masfacilityTypes ty inner join masfacilities f on f.facilitytypeid = ty.facilitytypeid and f.facilityid = :facilityId)
    `;
    
    const result = await db.execute(query, { warehouseId, facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
}

module.exports = {
    getCurrentStockDrugWise,
    getCurrentStockBatchWise,
    getFacilityStockDrugWise,
    getFacilityStockItemWise,
    getWarehouseStock
};
