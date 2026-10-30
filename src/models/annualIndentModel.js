const db = require('../config/db');
const oracledb = require('oracledb');

// Fetch items for the dropdown
async function getIndentItems(facilityId) {
  try {
    const query = `
      select Distinct r.itemid, SUBSTR(m.itemcode || '-' || itemname, 1, 70) itemname,
      round(nvl(r.dhsaprqty,0),0) dhsapr, round(nvl(cmhodistqty,0),0) cmhodistqty,
      round((nvl(r.dhsaprqty,0)-nvl(cmhodistqty,0)),0) bal, m.edlcat, m.itemcode
      from revisedannualindentitem r 
      inner join masitems m on m.itemid=r.itemid
      left outer join masedl e on e.edlcat=m.edlcat
      left outer join 
      (
        select itemid, f.districtid, sum(nvl(cmhodistqty,0)) cmhodistqty 
        from anualindent a 
        inner join masfacilities f on f.facilityid=a.facilityid
        where f.isactive=1 and a.accyrsetid=547 and f.districtid in (select distinct districtid from masfacilities where facilityid=:facilityId) 
        group by itemid, f.districtid
      ) x on x.itemid= r.itemid and x.districtid=r.districtid
      where r.dhsaprqty>0 and r.accyrsetid=547 and r.facilityid=:facilityId 
      and (nvl(r.dhsaprqty,0)-nvl(cmhodistqty,0))>0  
      order by m.itemcode
    `;

    const result = await db.execute(query, { facilityId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching indent items:', error);
    throw error;
  }
}

// Fetch the balance distribution quantity summary
async function getIndentSummary(facilityId, itemId) {
  try {
    const query = `
      select r.districtid, sum(round(r.dhsaprqty,0)) dhsaprqty,
      round(nvl(cmhodistqty,0),0) cmhodistqty,
      round((sum(round(r.dhsaprqty,0))-nvl(cmhodistqty,0)),0) balqty,
      e.edl, r.itemid, r.itemcode
      from revisedannualindentitem r
      left outer join 
      (
        select itemid, f.districtid, sum(nvl(cmhodistqty,0)) cmhodistqty 
        from anualindent a 
        inner join masfacilities f on f.facilityid=a.facilityid
        where f.isactive=1 and a.accyrsetid=547 and f.districtid in (select distinct districtid from masfacilities where facilityid=${facilityId}) 
        and itemid=${itemId}
        group by itemid, f.districtid
      ) x on x.itemid= r.itemid and x.districtid=r.districtid
      inner join masitems m on m.itemid=r.itemid
      left outer join masedl e on e.edlcat=m.edlcat
      where r.accyrsetid=547 and facilityid=${facilityId} and r.itemid=${itemId} 
      group by r.districtid, cmhodistqty, e.edl, r.itemid, r.itemcode
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching indent summary:', error);
    throw error;
  }
}

// Fetch the list of facilities and their distribution details
async function getFacilityDistributions(facilityId, itemId) {
  try {
    const query = `
      select Distinct 0 SlNo, a.indentid, ri.CMHODISTQTY, ri.DistStatus, nvl(ri.anualindentid,0) IssueItemID, 
      ri.itemid, f.facilityid, f.facilityname, nvl(ri.facilityindentqty,0) facilityindentqty, 
      fs.RECEIVED CgmscIssuetoFac, fs.curstock as CurrentStock, fs.issueqty wardissue
      from
      (
        select f.facilityid, f.facilityname, f.districtid, itemid, t.eldcat, t.hodid 
        from masfacilities f 
        inner join masfacilitytypes t on t.facilitytypeid=f.facilitytypeid
        ,masitems m
        where isactive=1 and f.districtid in (select distinct districtid from masfacilities where facilityid=${facilityId}) 
        and f.facilityname not like 'DHS%' and t.facilitytypeid not in (377)
        and t.hodid=2 and m.itemid =${itemId}
      ) f
      left outer join masanualindent a on a.facilityid=f.facilityid and a.accyrsetid=547 and a.status='C'
      left outer join anualindent ri on f.facilityid=ri.facilityid and ri.itemid =${itemId} and ri.accyrsetid=547 
      left outer join v_facilitystock1 fs on fs.facilityid=f.facilityid and fs.itemid=${itemId} and fs.facilityid=f.facilityid
      where  f.districtid in (select distinct districtid from masfacilities where facilityid=${facilityId}) 
      and f.facilityname not like 'DHS%'
      and f.eldcat >= (select edlcat from masitems where itemid=${itemId})
      group by fs.curstock, fs.RECEIVED, fs.issueqty, f.facilityid, f.facilityname, ri.facilityindentqty, ri.itemid, 
      ri.anualindentid, ri.DistStatus, ri.CMHODISTQTY, a.indentid
      order by f.facilityid
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  } catch (error) {
    console.error('Error fetching facility distributions:', error);
    throw error;
  }
}

// Insert a new distribution
async function insertDistribution(indentId, targetFacilityId, itemId, itemCode, distQty) {
  try {
    // We execute DML statements using db.execute. Assuming autoCommit is handled or we pass it
    const query = `
      Insert into anualindent 
      (INDENTID, FACILITYID, ITEMID, ITEMCODE, ACCYRSETID, FACILITYINDENTQTY, CMHODISTQTY, ENTRYDATE, DistStatus, CMHOAPPROVEDQTY, CMHOAPRSTATUS, status) 
      values (:indentId, :targetFacilityId, :itemId, :itemCode, 547, 0, :distQty, sysdate, 'Y', :distQty, 'C', 'C')
    `;
    await db.execute(query, { indentId, targetFacilityId, itemId, itemCode, distQty }, { autoCommit: true });
  } catch (error) {
    console.error('Error inserting distribution:', error);
    throw error;
  }
}

// Update an existing distribution
async function updateDistribution(issueItemId, distQty) {
  try {
    const query = `Update anualindent set CMHODISTQTY=:distQty, DistStatus='Y' where anualindentid=:issueItemId`;
    await db.execute(query, { distQty, issueItemId }, { autoCommit: true });
  } catch (error) {
    console.error('Error updating distribution:', error);
    throw error;
  }
}

// Delete an existing distribution (set to null)
async function deleteDistribution(issueItemId) {
  try {
    const query = `update anualindent set cmhodistqty=null, diststatus=null where anualindentid=:issueItemId`;
    await db.execute(query, { issueItemId }, { autoCommit: true });
  } catch (error) {
    console.error('Error deleting distribution:', error);
    throw error;
  }
}

// Fetch Medical College / Hospital AI vs Issuance Report
async function getMcHospitalAiVsIssuance(facilityId) {
  try {
    const facId = Number(facilityId) || 23393;
    const query = `
      select NOCPermission, a.itemid, facilityname, facAI_Nos, AIDist_Nos
      , nvl(itemstock,0) as FACStock
      , nvl(IssuedQTYNos,0) as WHIssuedCFY, case when (AIDist_Nos-nvl(IssuedQTYNos,0))>0 then AIDist_Nos-nvl(IssuedQTYNos,0) else 0 end as BalanceAIQTYNOS
      , ReadyWHSKU, ReadyWHNos, UQCNOS, UQCSKU, RECEIPTDATEATWAREHOUSE, QCPASSEDDATE,
      FACILITYID, hodid, accyrsetid, facilitytypeid, Statusyear, m.unitcount, a.WAREHOUSEID,
          m.ITEMNAME,
          m.ITEMCODE,
          m.STRENGTH,
          m.UNIT, m.MCATEGORY, ITEMTYPENAME, GROUPNAME
      from 
      (
        select a.itemid, sum(FACILITYINDENTQTY) facAI_Nos, sum(nvl(CMHODISTQTY,0)) AIDist_Nos, a.FACILITYID
            , a.accyrsetid, hodid, t.facilitytypeid, f.facilityname
            , case when sysdate between yr.startdate and yr.enddate then 'Y' else 'N' end as Statusyear
            , nvl(t.NOCApplyPermission,'N') as NOCPermission, wf.WAREHOUSEID
        from anualindent a 
        inner join masfacilities f on f.facilityid=a.facilityid     
        inner join masfacilitywh wf on wf.facilityid=f.facilityid
        inner join masfacilitytypes t on t.facilitytypeid=f.facilitytypeid
        inner join masaccyearsettings yr on yr.accyrsetid=a.accyrsetid
        where a.status = 'C' and f.isactive=1 and f.facilityid = :facId
        and (case when sysdate between yr.startdate and yr.enddate then 'Y' else 'N' end)='Y'     
        group by t.NOCApplyPermission, a.itemid, a.accyrsetid, hodid, t.facilitytypeid, f.facilityname, a.FACILITYID
               , yr.startdate, yr.enddate, wf.WAREHOUSEID
        having sum(nvl(CMHODISTQTY,0))>0  
      ) a
      left outer join 
      (
        select itemid, warehouseid, READYQTY * nvl(UNITCOUNT,1) as ReadyWHNos, READYQTY as ReadyWHSKU,
               NEAREXPQTY3MONTH * nvl(UNITCOUNT,1) as NEAREXPQTY3MONTH, NEAREXPQTY3MONTH as NEAREXPQTY3MONTHSKU,
               UQQTY * nvl(UNITCOUNT,1) as UQCNOS, UQQTY as UQCSKU, QCPASSEDDATE, RECEIPTDATEATWAREHOUSE 
        from V_WH_CURRENTSTOCK_STOCKSTATUS_Live l   
      ) whst on whst.itemid=a.itemid and whst.WAREHOUSEID=a.WAREHOUSEID
      left outer join
      (
        select itemid, sum(batchstock) as itemstock
        from
        (
          select b.batchno,
                 (case when b.qastatus = '1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) BatchStock,
                 b.inwno,
                 case when mi.EDLITEMCODE is not null then edlitemcode else mi.itemcode end as ITEMCODE,
                 case when mi.EDLITEMCODE is not null then mvm.itemid else 0 end as itemid
          from tbfacilityreceiptbatches b
          inner join tbfacilityreceiptitems i on b.facreceiptitemid = i.facreceiptitemid
          inner join tbfacilityreceipts t on t.facreceiptid = i.facreceiptid
          inner join vmasitems mi on mi.itemid = i.itemid
          inner join masfacilities f on f.facilityid = t.facilityid and f.facilityid = :facId
          inner join mv_masitems mvm on mvm.itemcode = mi.EDLITEMCODE
          left outer join
          (
            select fs.facilityid, fsi.itemid, ftbo.inwno, sum(nvl(ftbo.issueqty,0)) issueqty
            from tbfacilityissues fs
            inner join tbfacilityissueitems fsi on fsi.issueid = fs.issueid
            inner join tbfacilityoutwards ftbo on ftbo.issueitemid = fsi.issueitemid
            where fs.status = 'C' and fs.facilityid = :facId
            group by fsi.itemid, fs.facilityid, ftbo.inwno
          ) iq on b.inwno = iq.inwno and iq.itemid = i.itemid and iq.facilityid = t.facilityid
          where T.Status = 'C'
            and (b.Whissueblock = 0 or b.Whissueblock is null)
            and b.expdate > sysdate
            and f.facilityid = :facId
            and (case when b.qastatus = '1' then (nvl(b.absrqty,0) - nvl(iq.issueqty,0)) end) > 0
        ) group by itemid
      ) facstock on facstock.itemid = a.itemid
      left outer join 
      (
        select itemid, sum(iss_qty) iss_qty, sum(IssuedQTYNos) as IssuedQTYNos 
        from 
        (
          SELECT tb.facilityid, tbi.itemid,
                 (tbo.issueqty + NVL(tbo.reconcile_qty,0)) AS iss_qty,
                 (tbo.issueqty + NVL(tbo.reconcile_qty,0))*nvl(m.unitcount,1) AS IssuedQTYNos,
                 ay.ACCYRSETID
          FROM tbindents tb
          INNER JOIN masfacilities f ON f.facilityid = tb.facilityid
          INNER JOIN masfacilitytypes t ON t.facilitytypeid = f.facilitytypeid
          INNER JOIN tbindentitems tbi ON tbi.indentid = tb.indentid
          inner join masitems m on m.itemid=tbi.itemid
          INNER JOIN tboutwards tbo ON tbo.indentitemid = tbi.indentitemid
          INNER JOIN tbreceiptbatches rb ON rb.inwno = tbo.inwno
          INNER JOIN masaccyearsettings ay ON tb.INDENTDATE BETWEEN ay.startdate AND ay.enddate
          WHERE tb.issuetype = 'NO' and sysdate between ay.startdate and ay.enddate
            AND tb.status = 'C' and f.facilityid = :facId
        ) group by facilityid, itemid
      ) iss on iss.itemid=a.itemid
      inner join mv_masitems m on m.itemid=a.itemid
      order by m.itemcode
    `;

    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map(r => ({
      nocPermission: r.NOCPERMISSION || r.nocPermission || 'N',
      itemId: r.ITEMID || r.itemId,
      facilityName: r.FACILITYNAME || r.facilityName,
      facAiNos: r.FACAI_NOS || r.facAI_Nos || 0,
      aiDistNos: r.AIDIST_NOS || r.AIDist_Nos || 0,
      facStock: r.FACSTOCK || r.facStock || 0,
      whIssuedCfy: r.WHISSUEDCFY || r.whIssuedCFY || 0,
      balanceAiQtyNos: r.BALANCEAIQTYNOS || r.balanceAiQtyNos || 0,
      readyWhSku: r.READYWHSKU || r.readyWHSKU || 0,
      readyWhNos: r.READYWHNOS || r.readyWHNos || 0,
      uqcNos: r.UQCNOS || r.uqcNos || 0,
      uqcSku: r.UQCSKU || r.uqcSku || 0,
      receiptDateWh: r.RECEIPTDATEATWAREHOUSE || r.receiptDateAtWarehouse || null,
      qcPassedDate: r.QCPASSEDDATE || r.qcPassedDate || null,
      facilityId: r.FACILITYID || r.facilityId,
      hodId: r.HODID || r.hodId,
      accyrSetId: r.ACCYRSETID || r.accyrSetId,
      facilityTypeId: r.FACILITYTYPEID || r.facilityTypeId,
      statusYear: r.STATUSYEAR || r.statusYear,
      unitCount: r.UNITCOUNT || r.unitCount || 1,
      warehouseId: r.WAREHOUSEID || r.warehouseId,
      itemName: r.ITEMNAME || r.itemName,
      itemCode: r.ITEMCODE || r.itemCode,
      strength: r.STRENGTH || r.strength,
      unit: r.UNIT || r.unit,
      mCategory: r.MCATEGORY || r.mCategory,
      itemTypeName: r.ITEMTYPENAME || r.itemTypeName,
      groupName: r.GROUPNAME || r.groupName
    }));
  } catch (error) {
    console.error('Error fetching MC Hospital AI vs Issuance:', error);
    throw error;
  }
}

// 1. Ayush Download Excel Format Data (GetItemDetail in C#)
async function getAyushDownloadFormatData(facilityId, subCatId) {
  try {
    const usrFacilityID = Number(facilityId) || 29609;
    const factypeid = String(subCatId || '8').trim();
    const whereclause = factypeid === '8' ? '' : " and nvl(m.isedl2021,'N')='Y'";

    const query = `
      select 0 SlNo, m.itemcode,
             case when length(m.itemname) > 100 then substr(m.itemname, 0, 100) else itemname end itemname,
             t.itemtypename Formulation,
             case when length(m.strength1) > 100 then substr(m.strength1, 0, 100) else m.strength1 end Strength,
             nvl(m.unit, '-') as UNIT,
             e.edl,
             sc.catname || ' (' || mt.categoryname || ')' as categoryname,
             nvl(COSUMPTION_From_1APR_23, 0) as COSUMPTION_From_1APR_25,
             nvl(cr.CurStock, 0) as CurStock,
             0 INDENT_26_27,
             nvl(vr.rates, 0) as Rates
      from masitems m
      inner join masitemcategories mt on mt.categoryid = m.categoryid
      inner join masedl e on e.edlcat = m.edlcat
      inner join masitemtypes t on t.itemtypeid = m.itemtypeid
      inner join MasSubItemCategory sc on sc.subcatid = m.subcatid
      left outer join vlastrate vr on vr.itemid = m.itemid
      left outer join (
          select i.itemid, sum(nvl(rb.AbsRqty, 0)) - sum(nvl(x.issueQty, 0)) CurStock
          from tbFacilityReceiptBatches rb
          inner join tbfacilityreceiptitems i on rb.FACreceiptitemid = i.FACreceiptitemid
          inner join tbfacilityreceipts r on r.FACreceiptid = i.FACreceiptid
          left outer join (
              select FacilityID, sum(nvl(a.IssueQty, 0)) issueQty, 0 AbsRQty, a.Inwno
              from tbfacilityoutwards a
              inner join tbfacilityissueitems tbi on tbi.issueitemid = a.issueitemid
              inner join tbfacilityissues tb on tb.issueid = tbi.issueid
              where tb.FacilityID = :usrFacilityID
              group by a.Inwno, FacilityID
          ) x on x.inwno = rb.inwno and x.FacilityID = r.FacilityID
          where (rb.ExpDate >= SysDate or nvl(rb.ExpDate, SysDate) >= SysDate)
            and r.status = 'C' and r.FacilityID = :usrFacilityID
          group by i.itemid
          having sum(nvl(rb.AbsRqty, 0)) - sum(nvl(x.issueQty, 0)) > 0
      ) cr on cr.itemid = m.ItemID
      left outer join (
          select edlitemcode as itemcode, sum(iss_qty) COSUMPTION_From_1APR_23
          from (
              select tb.issueid, tbi.itemid, tbi.ISSUEITEMID, m.edlitemcode,
                     sum(tbo.issueqty) iss_qty, m.unitcount
              from tbfacilityissues tb
              inner join tbfacilityissueitems tbi on tbi.issueid = tb.issueid
              inner join tbfacilityoutwards tbo on tbo.ISSUEITEMID = tbi.ISSUEITEMID
              inner join tbfacilityreceiptbatches rb on rb.inwno = tbo.inwno
              inner join vmasitems m on m.itemid = tbi.itemid
              where tb.status = 'C'
                and tb.facilityid = :usrFacilityID
                and tb.issuedate between (select startdate from masaccyearsettings where accyrsetId = 545)
                                     and (select enddate from masaccyearsettings where accyrsetId = 545)
              group by tb.issueid, tbi.itemid, tbi.ISSUEITEMID, m.edlitemcode, m.unitcount
          ) i
          group by edlitemcode
      ) Consumption on Consumption.itemcode = m.itemcode
      where sc.subcatid in (${Number(factypeid) || 8})
        and m.isfreezed is null ${whereclause}
      order by m.ayushAIOrder
    `;

    const result = await db.execute(query, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      unit: r.UNIT || r.unit || '-',
      edl: r.EDL || r.edl || '-',
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      cosumptionFrom1Apr25: r.COSUMPTION_FROM_1APR_25 !== undefined ? r.COSUMPTION_FROM_1APR_25 : 0,
      curStock: r.CURSTOCK !== undefined ? r.CURSTOCK : 0,
      indent2627: r.INDENT_26_27 !== undefined ? r.INDENT_26_27 : 0,
      rates: r.RATES !== undefined ? r.RATES : 0,
      consumption: r.COSUMPTION_FROM_1APR_25 !== undefined ? r.COSUMPTION_FROM_1APR_25 : 0,
      currentStock: r.CURSTOCK !== undefined ? r.CURSTOCK : 0,
      rate: r.RATES !== undefined ? r.RATES : 0
    }));
  } catch (error) {
    console.error('Error fetching Ayush Download Format Data:', error);
    throw error;
  }
}

// 2. Annual Indent Excel Download Format Data (DHS / General Format Query OR DME Query)
async function getDownloadAiFormatData(facilityId, categoryId, facilityTypeId) {
  try {
    const usrFacilityID = Number(facilityId) || 22595;
    const inputCatId = Number(categoryId) || 0;

    // Check if facility is DME (by facilityTypeId parameter, or DB check on masfacilities)
    let isDme = false;
    const cleanFacTypeId = facilityTypeId !== undefined && facilityTypeId !== null ? String(facilityTypeId).trim() : '';
    if (cleanFacTypeId === '364' || cleanFacTypeId === '378') {
      isDme = true;
    } else {
      const facCheckRes = await db.execute(
        `SELECT f.facilitytypeid, t.facilitytypecode 
         FROM masfacilities f 
         LEFT JOIN masfacilitytypes t ON t.facilitytypeid = f.facilitytypeid 
         WHERE f.facilityid = :usrFacilityID`,
        { usrFacilityID },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (facCheckRes.rows && facCheckRes.rows[0]) {
        const ftId = String(facCheckRes.rows[0].FACILITYTYPEID || facCheckRes.rows[0].facilitytypeid || '');
        const ftCode = String(facCheckRes.rows[0].FACILITYTYPECODE || facCheckRes.rows[0].facilitytypecode || '').toUpperCase();
        if (ftId === '364' || ftId === '378' || ftCode.includes('DME')) {
          isDme = true;
        }
      }
    }

    if (isDme) {
      // DME Facility Specific Query
      const dmeQuery = `
        select 0 SlNo,Formate.itemcode,Formate.itemname,Formate.Formulation,Formate.Strength,Formate.GroupName,
          Formate.edl,nvl(Consumption.COSUMPTION_From_1APR_25,'0') COSUMPTION_From_1APR_26, nvl(cr.CurStock,0) as Current_Stock,INDENT_26_27  as INDENT_27_28
    ,nvl(vr.singlerate,0) as Rate,Formate.unitcount as PACKAGINGUNIT,Formate.categoryname,
    Formate.EDLType
          from
          (
          select 0 SlNo ,m.itemcode,m.ItemID,case when length(m.itemname)>100 
          then substr(m.itemname,0,100) else itemname end itemname,t.itemtypename Formulation,
          case when length(m.strength1)>100 then substr(m.strength1,0,100) else m.strength1 
          end Strength,g.groupname GroupName,e.edl, 
                0 COSUMPTION_From_1APR_25,0 INDENT_26_27   ,m.unitcount ,mc.mcid,mt.categoryname,
                CASE 
                    WHEN m.EDL2025 = 'Y' 
                     AND (m.edl2025flag = 'COMMON' OR m.edl2025flag = 'CME' OR m.edl2025flag = 'DME') 
                    THEN 'EDL' 
                    ELSE 'Non EDL' 
                END AS EDLType  
                from masitems m inner join masitemgroups g on m.groupid=g.groupid  
                inner join masitemcategories mt on mt.categoryid=m.categoryid 
                inner join masitemmaincategory mc on mc.mcid=mt.mcid
                inner join masedl e on e.edlcat=m.edlcat 
                inner join masitemtypes t on t.itemtypeid=m.itemtypeid where mt.categoryid 
                in(52,53,54,55) and m.EDL2025='Y' and m.EDL2025FLAG in ('COMMON','CME') and m.isfreez_itpr is null
                ) Formate
                left outer join   v_itemrate vr on vr.itemid=Formate.itemid
                left outer join
                (
                select itemcode,nvl((issuedqty_NOS),'0') as COSUMPTION_From_1APR_25
          from(

    select itemcode,(sum(iss_qty)*unitcount) issuedqty_NOS from (
                  select tb.indentid,tbi.itemid,tbi.indentitemid,m.itemcode,  
                  sum(tbo.issueqty + nvl(tbo.reconcile_qty,0)) iss_qty ,m.unitcount
                   from tbindents tb
                   inner join tbindentitems tbi on tbi.indentid=tb.indentid 
                   inner join tboutwards tbo on tbo.indentitemid=tbi.indentitemid
                   inner join tbreceiptbatches rb on rb.inwno=tbo.inwno
                   inner join masitems m on m.itemid = tbi.itemid
                   inner join masfacilities f on f.facilityid = tb.facilityid   
                  where tb.status = 'C' and tb.issuetype='NO' and f.facilityid = :usrFacilityID
                  and tb.indentdate between (select startdate from masaccyearsettings where accyrsetId =(select accyrsetId from masaccyearsettings where sysdate between startdate and enddate)) 
                  and (select enddate from masaccyearsettings where accyrsetId =(select accyrsetId from masaccyearsettings where sysdate between startdate and enddate))         
                  and tb.notindpdmis is null and tb.notindpdmis is null and tbi.notindpdmis is null   
                  and tbo.notindpdmis is null and rb.notindpdmis is null  
                  group by 
                  tb.indentid,tbi.itemid,tbi.indentitemid,m.itemcode,m.unitcount             
                  ) i 
                  inner join tbindentitems tbi on tbi.itemid = i.itemid and tbi.indentitemid = i.indentitemid 
                  group by itemcode,unitcount
   
                  )
                ) Consumption on Formate.itemcode=Consumption.itemcode
  left outer join 
                (
                select i.itemid, sum(nvl(rb.AbsRqty,0))- sum(nvl(x.issueQty,0)) CurStock
  from tbFacilityReceiptBatches rb  
  inner join tbfacilityreceiptitems i on rb.FACreceiptitemid=i.FACreceiptitemid  
  inner join tbfacilityreceipts r on r.FACreceiptid=i.FACreceiptid 
  left outer join (
    select  FacilityID,sum(nvl(a.IssueQty,0)) issueQty, 0 AbsRQty,  
  a.Inwno   
  from  tbfacilityoutwards a
  inner join tbfacilityissueitems tbi on tbi.issueitemid =a.issueitemid   
  inner join tbfacilityissues tb on tb.issueid=tbi.issueid    
  where tb.FacilityID = :usrFacilityID
  --and tbi.itemid=mitemid 
  group by a.Inwno ,FacilityID   
  ) x on x.inwno=rb.inwno and x.FacilityID=r.FacilityID
  where   (rb.ExpDate >= SysDate or nvl(rb.ExpDate,SysDate) >= SysDate) 
  and r.status='C' and r.FacilityID = :usrFacilityID  
  group by i.itemid
  having  sum(nvl(rb.AbsRqty,0))- sum(nvl(x.issueQty,0))>0
                
                )cr on cr.itemid=Formate.ItemID
        order by Formate.groupname, Formate.itemname
      `;

      const dmeResult = await db.execute(dmeQuery, { usrFacilityID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const dmeRows = dmeResult.rows || [];
      return dmeRows.map((r, idx) => ({
        slNo: idx + 1,
        itemCode: r.ITEMCODE || r.itemcode || '-',
        itemName: r.ITEMNAME || r.itemname || '-',
        formulation: r.FORMULATION || r.formulation || '-',
        strength: r.STRENGTH || r.strength || '-',
        groupName: r.GROUPNAME || r.groupname || '-',
        edl: r.EDL || r.edl || '-',
        cosumptionFrom1Apr26: Number(r.COSUMPTION_FROM_1APR_26 !== undefined ? r.COSUMPTION_FROM_1APR_26 : 0),
        currentStock: Number(r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0),
        indent2728: Number(r.INDENT_27_28 !== undefined ? r.INDENT_27_28 : 0),
        rate: Number(r.RATE !== undefined ? r.RATE : 0),
        packagingUnit: Number(r.PACKAGINGUNIT !== undefined ? r.PACKAGINGUNIT : 1),
        categoryName: r.CATEGORYNAME || r.categoryname || 'DRUGS',
        edlType: (String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'YES' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'Y' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'EDL') ? 'EDL' : 'Non EDL',
        isDme: true
      }));
    }

    let realCatId = inputCatId;
    if (realCatId > 0) {
      const subRes = await db.execute(
        `select categoryid from massubitemcategory where subcatid = :realCatId`,
        { realCatId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (subRes.rows && subRes.rows.length > 0) {
        realCatId = Number(subRes.rows[0].CATEGORYID || subRes.rows[0].categoryid);
      }
    }

    const binds = { usrFacilityID };
    let categoryClause = 'mc.MCID IN (1, 2)';
    if (realCatId > 0) {
      categoryClause = 'mt.categoryid = :realCatId';
      binds.realCatId = realCatId;
    }

    const query = `
    SELECT 
        0 AS SlNo,
        Formate.itemcode,
        SUBSTR(Formate.itemname, 1, 100) AS itemname,
        Formate.Formulation,
        SUBSTR(Formate.Strength, 1, 100) AS Strength,
        Formate.GroupName,
        Formate.edl,
        NVL(iss.FacIssueqty, 0) AS Issued_From_WH_01_Apr_26_to_31st_Oct_26,
        0 AS Actual_Consumption_From_01_April_26_to_31st_Oct_26,
        0 AS Estimated_Consumption_For_One_Year_From_01_April_26_to_31st_March_27,
        NVL(cr.CurStock, 0) AS Current_Stock,
        0 AS ANNUAL_INDENT_27_28,
        NVL(vr.singlerate, 0) AS Rate,
        Formate.categoryname,
        Formate.EDLType
    FROM
    (
        SELECT 
            0 AS SlNo,
            m.itemcode,
            m.ItemID,
            CASE 
                WHEN LENGTH(m.itemname) > 100 THEN SUBSTR(m.itemname, 0, 100)
                ELSE itemname 
            END AS itemname,
            t.itemtypename AS Formulation,
            CASE 
                WHEN LENGTH(m.strength1) > 100 THEN SUBSTR(m.strength1, 0, 100) 
                ELSE m.strength1 
            END AS Strength,
            g.groupname AS GroupName,
            e.edl,
            0 AS COSUMPTION_From_1APR_24,
            0 AS Current_Stock,
            0 AS INDENT_25_26,
            m.isedl2021,
            mt.categoryname,
            CASE 
                WHEN isedl2021 = 'Y' THEN 'Yes' 
                ELSE 'No' 
            END AS EDL2021,
            CASE 
                WHEN EDL2025 = 'Y' THEN 'Yes' 
                ELSE 'No' 
            END AS EDL2025,
            CASE 
                WHEN (edl2025flag = 'COMMON' OR edl2025flag = 'DHS') 
                THEN 'Yes' 
                ELSE 'No' 
            END AS IsIPHS,
            CASE 
                WHEN EDL2025 = 'Y' 
                 AND (edl2025flag = 'COMMON' OR edl2025flag = 'DHS') 
                THEN 'EDL' 
                ELSE 'Non EDL' 
            END AS EDLType,
            mc.mcid
        FROM masitems m 
        INNER JOIN masitemai ai 
            ON ai.itemid = m.itemid 
           AND ai.ACCYRSETID = (
                SELECT accyrsetId + 1 
                FROM masaccyearsettings 
                WHERE SYSDATE BETWEEN startdate AND enddate
           )
        INNER JOIN masitemgroups g 
            ON m.groupid = g.groupid  
        INNER JOIN masitemcategories mt 
            ON mt.categoryid = m.categoryid 
        INNER JOIN masitemmaincategory mc 
            ON mc.MCID = mt.MCID
        INNER JOIN masedl e 
            ON e.edlcat = m.edlcat 
        INNER JOIN masitemtypes t 
            ON t.itemtypeid = m.itemtypeid
        WHERE ${categoryClause}
          AND m.isfreez_itpr IS NULL 
          AND m.edlcat <= (
                SELECT ft.edlindent 
                FROM masfacilities f 
                INNER JOIN masfacilitytypes ft 
                    ON ft.facilitytypeid = f.facilitytypeid 
                WHERE f.facilityid = :usrFacilityID
          ) 
    ) Formate

    LEFT OUTER JOIN v_itemrate vr 
        ON vr.itemid = Formate.itemid

    LEFT OUTER JOIN
    (
        SELECT 
            ii.itemid,
            SUM(tbo.issueqty) AS FacIssueqty 
        FROM tbfacilityissues i
        INNER JOIN tbfacilityissueitems ii 
            ON ii.issueid = i.issueid
        INNER JOIN tbfacilityoutwards tbo 
            ON tbo.issueitemid = ii.issueitemid
        INNER JOIN tbfacilityreceiptbatches rb 
            ON rb.inwno = tbo.inwno
        WHERE 1=1 
          AND i.status = 'C'
          AND i.facilityid = :usrFacilityID 
          AND i.issuedate BETWEEN (
                SELECT startdate 
                FROM masaccyearsettings 
                WHERE accyrsetId = (
                    SELECT accyrsetId 
                    FROM masaccyearsettings 
                    WHERE SYSDATE BETWEEN startdate AND enddate
                )
          ) 
          AND (
                SELECT enddate 
                FROM masaccyearsettings 
                WHERE accyrsetId = (
                    SELECT accyrsetId 
                    FROM masaccyearsettings 
                    WHERE SYSDATE BETWEEN startdate AND enddate
                )
          )
        GROUP BY ii.itemid
    ) iss 
        ON iss.itemid = Formate.ItemID

    LEFT OUTER JOIN
    (
        SELECT 
            itemid,
            SUM(ReadyForIssue) AS CurStock 
        FROM (
            SELECT 
                b.batchno,
                b.expdate, 
                b.inwno,
                t.facilityid, 
                i.itemid, 
                CASE 
                    WHEN b.qastatus = '1' 
                    THEN (NVL(b.absrqty, 0) - NVL(iq.issueqty, 0)) 
                END AS ReadyForIssue  
            FROM tbfacilityreceiptbatches b   
            INNER JOIN tbfacilityreceiptitems i 
                ON b.facreceiptitemid = i.facreceiptitemid 
            INNER JOIN tbfacilityreceipts t 
                ON t.facreceiptid = i.facreceiptid                  
            LEFT OUTER JOIN 
            (  
                SELECT  
                    fs.facilityid,
                    fsi.itemid,
                    ftbo.inwno,
                    SUM(NVL(ftbo.issueqty, 0)) AS issueqty   
                FROM tbfacilityissues fs 
                INNER JOIN tbfacilityissueitems fsi 
                    ON fsi.issueid = fs.issueid 
                INNER JOIN tbfacilityoutwards ftbo 
                    ON ftbo.issueitemid = fsi.issueitemid 
                WHERE fs.status = 'C'   
                  AND fs.facilityid = :usrFacilityID             
                GROUP BY 
                    fsi.itemid, 
                    fs.facilityid, 
                    ftbo.inwno                     
            ) iq 
                ON b.inwno = iq.inwno 
               AND iq.itemid = i.itemid 
               AND iq.facilityid = t.facilityid                 
            WHERE t.Status = 'C'  
              AND (b.Whissueblock = 0 OR b.Whissueblock IS NULL) 
              AND b.expdate > SYSDATE 
              AND t.facilityid = :usrFacilityID
        ) 
        GROUP BY itemid  
        HAVING SUM(ReadyForIssue) > 0
    ) cr 
        ON cr.itemid = Formate.ItemID

    ORDER BY 
        DECODE(Formate.isedl2021, 'Y', 1), 
        DECODE(
            Formate.categoryname, 
            'DRUGS', 1, 
            'CONSUMABLE AND SURGICAL', 2, 
            'SURGICALS AND SUTURES', 3
        ),
        Formate.groupname,
        Formate.itemname`;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      groupName: r.GROUPNAME || r.groupname || '-',
      edl: r.EDL || r.edl || '-',
      issuedFromWh: r.ISSUED_FROM_WH_01_APR_26_TO_31ST_OCT_26 !== undefined ? r.ISSUED_FROM_WH_01_APR_26_TO_31ST_OCT_26 : 0,
      actualConsumption: r.ACTUAL_CONSUMPTION_FROM_01_APRIL_26_TO_31ST_OCT_26 !== undefined ? r.ACTUAL_CONSUMPTION_FROM_01_APRIL_26_TO_31ST_OCT_26 : 0,
      estimatedConsumption: r.ESTIMATED_CONSUMPTION_FOR_ONE_YEAR_FROM_01_APRIL_26_TO_31ST_MARCH_27 !== undefined ? r.ESTIMATED_CONSUMPTION_FOR_ONE_YEAR_FROM_01_APRIL_26_TO_31ST_MARCH_27 : 0,
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      annualIndent2728: r.ANNUAL_INDENT_27_28 !== undefined ? r.ANNUAL_INDENT_27_28 : 0,
      annualIndent2627: r.ANNUAL_INDENT_27_28 !== undefined ? r.ANNUAL_INDENT_27_28 : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      edlType: (String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'YES' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'Y' || String(r.EDLTYPE || r.edltype || r.EDLType || '').trim().toUpperCase() === 'EDL') ? 'EDL' : 'Non EDL'
    }));
  } catch (error) {
    console.error('Error fetching Download AI Format Data:', error);
    throw error;
  }
}

function getDynamicIndentHeaders() {
  const now = new Date();
  const currentYear = now.getFullYear(); // e.g. 2026
  const currYr = String(currentYear).slice(-2); // "26"
  const nextYr1 = String(currentYear + 1).slice(-2); // "27"
  const nextYr2 = String(currentYear + 2).slice(-2); // "28"

  return {
    currYr,
    nextYr1,
    nextYr2,
    consumptionHeader: `COSUMPTION_From_1APR_${currYr}`,
    indentHeader: `Non_EDL_INDENT_${nextYr1}_${nextYr2}`
  };
}

// Fetch Non-EDL Annual Indent Format Data using exact user query
async function getDownloadNonEdlFormatData(facilityId, categoryId) {
  try {
    const { consumptionHeader, indentHeader } = getDynamicIndentHeaders();
    const query = `
      SELECT 
        0 AS SlNo,
        m.itemcode,
        CASE 
          WHEN LENGTH(m.itemname) > 100 THEN SUBSTR(m.itemname, 1, 100) 
          ELSE m.itemname 
        END AS itemname,
        t.itemtypename AS Formulation,
        CASE 
          WHEN LENGTH(m.strength1) > 100 THEN SUBSTR(m.strength1, 1, 100) 
          ELSE m.strength1 
        END AS Strength, 
        0 AS ${consumptionHeader},
        0 AS Current_Stock,
        0 AS ${indentHeader},
        NVL(vr.singlerate, 0) AS Rate,
        NVL(m.unitcount, 1) AS PACKAGINGUNIT,
        mt.categoryname
      FROM masitems m 
      INNER JOIN masitemcategories mt ON mt.categoryid = m.categoryid    
      INNER JOIN masitemmaincategory mc ON mc.mcid = mt.mcid  
      LEFT OUTER JOIN masitemtypes t ON t.itemtypeid = m.itemtypeid 
      LEFT OUTER JOIN v_itemrate vr ON vr.itemid = m.itemid
      WHERE 1=1 
        AND (NVL(m.EDL2025, 'N') = 'N' OR m.EDL2025FLAG = 'DHS') 
        AND m.isfreez_itpr IS NULL
        AND m.categoryid IN (52, 53, 54, 55, 56, 63, 65, 66)  
        AND m.isfreez_itpr IS NULL  
      ORDER BY mc.mcid, m.itemcode
    `;

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    const consKey = consumptionHeader.toUpperCase();
    const indKey = indentHeader.toUpperCase();
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      consumptionFrom1Apr: r[consKey] !== undefined ? r[consKey] : 0,
      consumptionFrom1Apr25: r[consKey] !== undefined ? r[consKey] : 0,
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      nonEdlIndent: r[indKey] !== undefined ? r[indKey] : 0,
      nonEdlIndent2627: r[indKey] !== undefined ? r[indKey] : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      packagingUnit: r.PACKAGINGUNIT !== undefined ? r.PACKAGINGUNIT : 1,
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      consumptionHeader,
      indentHeader
    }));
  } catch (error) {
    console.error('Error fetching Download Non-EDL AI Format Data:', error);
    throw error;
  }
}

// Fetch Reagent/Non EDL Consumables and Kits Annual Indent Format Data using exact user query
async function getDownloadReagentNonEdlFormatData(facilityId, facilityTypeId) {
  try {
    let facTypeId = facilityTypeId ? String(facilityTypeId).trim() : '';

    if (!facTypeId && facilityId) {
      try {
        const facRes = await db.execute(
          `SELECT FACILITYTYPEID FROM MASFACILITIES WHERE FACILITYID = :facilityId`,
          [facilityId],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (facRes.rows && facRes.rows.length > 0) {
          facTypeId = String(facRes.rows[0].FACILITYTYPEID || facRes.rows[0].facilitytypeid || '').trim();
        }
      } catch (err) {
        console.warn('Could not determine facility type from DB:', err.message);
      }
    }

    const { consumptionHeader, indentHeader } = getDynamicIndentHeaders();

    let query = '';
    if (facTypeId === '364' || facTypeId === '378') {
      query = `
        select 0 SlNo,
               m.itemcode,
               case when length(m.itemname) > 100 then substr(m.itemname, 1, 100) else m.itemname end itemname,
               t.itemtypename Formulation,
               case when length(m.strength1) > 100 then substr(m.strength1, 1, 100) else m.strength1 end Strength,
               0 ${consumptionHeader},
               0 Current_Stock,
               0 ${indentHeader},
               nvl(vr.singlerate, 0) as Rate
        from masitems m
        inner join masitemcategories mt on mt.categoryid = m.categoryid
        inner join masitemtypes t on t.itemtypeid = m.itemtypeid
        left outer join v_itemrate vr on vr.itemid = m.itemid
        where 1 = 1
          and m.categoryid in (62)
          and m.isfreez_itpr is null
          and m.mmid is null
          and nvl(m.EDL2025FLAG, 'N') = 'N'
        order by m.itemcode
      `;
    } else {
      query = `
        select 0 SlNo,
               m.itemcode,
               case when length(m.itemname) > 100 then substr(m.itemname, 1, 100) else m.itemname end itemname,
               t.itemtypename Formulation,
               case when length(m.strength1) > 100 then substr(m.strength1, 1, 100) else m.strength1 end Strength,
               0 ${consumptionHeader},
               0 Current_Stock,
               0 ${indentHeader},
               nvl(vr.singlerate, 0) as Rate
        from masitems m
        inner join masitemcategories mt on mt.categoryid = m.categoryid
        inner join masitemtypes t on t.itemtypeid = m.itemtypeid
        left outer join v_itemrate vr on vr.itemid = m.itemid
        where 1 = 1
          and m.categoryid in (62)
          and m.isfreez_itpr is null
          and nvl(m.EDL2025FLAG, 'N') = 'N'
        order by m.itemcode
      `;
    }

    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    const consKey = consumptionHeader.toUpperCase();
    const indKey = indentHeader.toUpperCase();
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      consumptionFrom1Apr: r[consKey] !== undefined ? r[consKey] : 0,
      consumptionFrom1Apr25: r[consKey] !== undefined ? r[consKey] : 0,
      currentStock: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : 0,
      nonEdlIndent: r[indKey] !== undefined ? r[indKey] : 0,
      nonEdlIndent2627: r[indKey] !== undefined ? r[indKey] : 0,
      rate: r.RATE !== undefined ? r.RATE : 0,
      packagingUnit: 1,
      categoryName: 'REAGENT',
      consumptionHeader,
      indentHeader
    }));
  } catch (error) {
    console.error('Error fetching Download Reagent/Non-EDL AI Format Data:', error);
    throw error;
  }
}


// Fetch Item Categories for Download Excel Format Dropdown
async function getIndentCategories(usrFacilityID) {
  try {
    const query = `
      SELECT
        sc.subcatid AS subcatid,
        c.categoryid AS categoryid,
        sc.catname || ' (' || c.categoryname || ')' AS categoryname
      FROM masitemcategories c
      INNER JOIN MasSubItemCategory sc
        ON sc.categoryid = c.categoryid
      WHERE c.categoryid IN (61, 59, 60, 58, 54)
        AND sc.subcatid NOT IN (
          SELECT CASE
                   WHEN AYFACTYPEID IN (13, 11) THEN 0
                   ELSE 7
                 END
          FROM masfacilities
          WHERE facilityid = :usrFacilityID
        )
      ORDER BY sc.subcatid
    `;

    const result = await db.execute(
      query,
      { usrFacilityID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return (result.rows || []).map(r => ({
      subcatId: r.SUBCATID,
      categoryId: r.CATEGORYID,
      categoryName: r.CATEGORYNAME
    }));

  } catch (error) {
    console.error('Error fetching Indent Categories:', error);
    throw error;
  }
}

// Get Financial Years for Upload & Forward Annual Indent
async function getUploadForwardFinYears() {
  try {
    const query = `
      select accyrsetid, accyear,
             case when sysdate between startdate and enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings 
      where accyrsetid > 537 
      order by accyrsetid desc
    `;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching Upload Forward Fin Years:', error);
    throw error;
  }
}

// Fetch Upload & Forward Annual Indent List (AnualindentMain.aspx)
async function getUploadForwardList(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const query = `
      select null SlNo, a.DispatchNo, to_char(a.DispatchDate,'dd-mm-yyyy') DispatchDate, a.indentid NOCID, 
             a.indentno NOCNumber, to_char(a.indentdate,'dd-mm-yyyy') NOCDATE, 
             CASE a.Status   
               WHEN 'I' THEN 'Incomplete'  
               WHEN 'S' THEN 'Sent for Approval'  
               WHEN 'C' THEN 'Completed'  
               WHEN 'D' THEN 'Deleted' 
               ELSE 'Completed'
             end status, 
             c.AccYear, a.facilityID, 
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
               mc.categoryname,
               (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
               'General'
             ) categoryname 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
      where a.nonedlindenttype is null and a.isreagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId 
      Order by a.indentdate desc
    `;

    const result = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // Check facility type / role for DH
    let isDh = false;
    try {
      const facCheckRes = await db.execute(
        `select f.facilityname, ft.facilitytypecode, ft.facilitytypedesc 
         from masfacilities f 
         left outer join masfacilitytypes ft on f.facilitytypeid = ft.facilitytypeid 
         where f.facilityid = :facId`,
        { facId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (facCheckRes.rows && facCheckRes.rows.length > 0) {
        const fRow = facCheckRes.rows[0];
        const fCode = String(fRow.FACILITYTYPECODE || fRow.facilitytypecode || '').toUpperCase();
        const fDesc = String(fRow.FACILITYTYPEDESC || fRow.facilitytypedesc || '').toUpperCase();
        const fName = String(fRow.FACILITYNAME || fRow.facilityname || '').toUpperCase();
        if (fCode === 'DH' || fCode.includes('DH') || fDesc.includes('DH') || fDesc.includes('DISTRICT HOSPITAL') || fName.startsWith('DH ') || fName.includes('DISTRICT HOSPITAL')) {
          isDh = true;
        }
      }
    } catch (e) {
      console.error('Error checking facility type for DH:', e);
    }

    // If DH: only allow adding if there are no existing indents in that year
    const canAdd = isDh ? (rows.length === 0) : true;
    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      facilityId: r.FACILITYID || r.facilityId,
      categoryName: r.CATEGORYNAME || r.categoryName || 'General',
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd };
  } catch (error) {
    console.error('Error fetching Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Non-EDL Upload & Forward Annual Indent List (NONEDLAnualindentMain.aspx)
async function getNonEdlUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 546;

    let statusClause = '';
    const binds = { facId, fyId };
    if (status && status !== 'All') {
      statusClause = ' and a.Status = :status ';
      binds.status = status;
    }

    const query = `
      select null SlNo, a.DispatchNo, to_char(a.DispatchDate,'dd-mm-yyyy') DispatchDate, a.indentid NOCID, 
             a.indentno NOCNumber, to_char(a.indentdate,'dd-mm-yyyy') NOCDATE, 
             CASE a.Status   
               WHEN 'I' THEN 'Incomplete'  
               WHEN 'S' THEN 'Sent for Approval'  
               WHEN 'C' THEN 'Completed'  
               WHEN 'D' THEN 'Deleted' 
               ELSE 'Completed'
             end status, 
             c.AccYear, a.facilityID, a.AccYrSetID 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.NONEDLIndentType = 'Y' 
        and a.isReagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId
        ${statusClause}
      Order by a.indentdate
    `;

    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    // Check if an indent exists for this facility & fin year
    const cntQuery = `
      select count(indentid) as CNT 
      from masanualindent 
      where NONEDLIndentType = 'Y' 
        and isReagent is null 
        and facilityid = :facId 
        and accyrsetid = :fyId
    `;
    const cntRes = await db.execute(cntQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const count = Number(cntRes.rows?.[0]?.CNT || 0);
    // When count == 0, canAdd = true (shows imgAdd). When count > 0, canAdd = false.
    const canAdd = count === 0;

    const list = rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      categoryName: 'NON-EDL',
      facilityId: r.FACILITYID || r.facilityId,
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));

    return { list, canAdd, count };
  } catch (error) {
    console.error('Error fetching Non-EDL Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Header info for Create/Edit Annual Indent (AnualItemIndent.aspx)
async function getCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const query = `
        select a.indentid, a.indentno, to_char(a.indentdate,'dd-mm-yyyy') indentdate, a.status, a.AIcategoryid, 
               coalesce(
                 (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                 mc.categoryname,
                 (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
                 'General'
               ) categoryname 
        from masAnualIndent a
        left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
        where a.indentid = :indId and a.facilityid = :facId
      `;
      const result = await db.execute(query, { indId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (result.rows && result.rows.length > 0) {
        const r = result.rows[0];
        return {
          indentId: r.INDENTID || r.indentId,
          indentNo: r.INDENTNO || r.indentNo,
          indentDate: r.INDENTDATE || r.indentDate,
          status: r.STATUS || r.status,
          categoryId: r.AICATEGORYID || r.aiCategoryId || 0,
          categoryName: r.CATEGORYNAME || r.categoryName || 'General',
          exists: true
        };
      }
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: 'System Generated',
      status: 'N',
      categoryId: 0,
      categoryName: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Create Indent Header:', error);
    throw error;
  }
}

// Fetch Items Grid & Summary info for Create/Edit Annual Indent
async function getCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 0;
    const indId = Number(indentId) || 0;

    let itemsQuery = `
      select 0 SlNo, a.ANUALINDENTID, a.itemid, g.groupname, nvl(a.consumption,0) as consumption,
             nvl(a.PROJECTEDCONSUMPTION,0) as PROJECTEDCONSUMPTION, nvl(a.consumption,0)+nvl(a.PROJECTEDCONSUMPTION,0) as TotalConsumption,
             a.currentstock, a.facilityindentqty, a.status flag, nvl(a.Rate,0) as Rate,
             a.facilityindentqty*nvl(a.Rate,0) as indAprVal,
             m.ItemCode, m.ItemName, m.Strength1, m.Unit, m.PackingQty, b.ItemTypeCode,
             case when m.isedl2021='Y' then 'Yes' else 'No' end as EDL2021,
             case when m.EDL2025='Y' then 'Yes' else 'No' end as EDL2025,
             case when (m.edl2025flag='Common' or m.edl2025flag='DHS') then 'Yes' else 'No' end as IsIPHS,
             a.ACTUALCONSUMPTION
      from masanualindent ma 
      inner join anualindent a on a.indentid=ma.indentid
      inner join masitems m on a.itemid=m.itemid  
      left outer join masitemgroups g on g.groupid=m.groupid  
      inner join masitemcategories mt on mt.categoryid=m.categoryid 
      left outer Join masItemTypes b on (b.ItemTypeID = m.ItemTypeID)
      where ma.indentid = :indId 
        and nvl(a.facilityindentqty, 0) > 0
    `;
    const binds = { indId };
    if (facId > 0) {
      itemsQuery += ` and ma.facilityid = :facId`;
      binds.facId = facId;
    }
    if (fyId > 0) {
      itemsQuery += ` and ma.accyrsetid = :fyId`;
      binds.fyId = fyId;
    }
    itemsQuery += ` order by m.itemname`;

    const itemsRes = await db.execute(itemsQuery, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = itemsRes.rows || [];

    const items = rows.map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualIndentId,
      itemId: r.ITEMID || r.itemId,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      packingQty: r.PACKINGQTY || r.packingQty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemTypeCode || '-',
      groupName: r.GROUPNAME || r.groupName || '-',
      consumption: r.CONSUMPTION || r.consumption || 0,
      actualConsumption: r.ACTUALCONSUMPTION || r.actualConsumption || 0,
      projectedConsumption: r.PROJECTEDCONSUMPTION || r.projectedConsumption || 0,
      totalConsumption: r.TOTALCONSUMPTION || r.totalConsumption || 0,
      currentStock: r.CURRENTSTOCK || r.currentStock || 0,
      facilityIndentQty: r.FACILITYINDENTQTY || r.facilityIndentQty || 0,
      rate: r.RATE || r.rate || 0,
      indAprVal: r.INDAPRVAL || r.indAprVal || 0,
      flag: r.FLAG || r.flag || 'I'
    }));

    // Calculate Summary Values
    const summaryQuery = `
      select a.indentid, count(distinct ai.itemid) cntIte,
             sum(nvl(ai.FACILITYINDENTQTY,0)*nvl(ai.Rate,0)) as totalValRs
      from masanualindent a 
      inner join anualindent ai on ai.indentid=a.indentid
      where a.indentid = :indId and nvl(ai.FACILITYINDENTQTY,0) > 0
      group by a.indentid
    `;
    const summaryRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = 0;
    let aproxIndentValue = '0.00';
    if (summaryRes.rows && summaryRes.rows.length > 0) {
      noOfItems = Number(summaryRes.rows[0].CNTITE || summaryRes.rows[0].cntIte || 0);
      const totalRs = Number(summaryRes.rows[0].TOTALVALRS || summaryRes.rows[0].totalValRs || 0);
      const crVal = totalRs / 10000000;
      if (crVal >= 0.01) {
        aproxIndentValue = crVal.toFixed(2);
      } else if (crVal > 0) {
        aproxIndentValue = crVal.toFixed(4);
      } else {
        aproxIndentValue = '0.00';
      }
    }

    return {
      items,
      noOfItems,
      aproxIndentValue
    };
  } catch (error) {
    console.error('Error fetching Create Indent Items:', error);
    throw error;
  }
}

// Update single item row in anualindent
async function updateCreateIndentItem(anualIndentId, consumption, actualConsumption, projectedConsumption, currentStock, facilityIndentQty, rate) {
  try {
    const query = `
      update anualindent 
      set consumption = :consumption,
          actualconsumption = :actualConsumption,
          projectedconsumption = :projectedConsumption,
          currentstock = :currentStock,
          facilityindentqty = :facilityIndentQty,
          rate = :rate
      where anualindentid = :anualIndentId
    `;
    await db.execute(query, {
      consumption: Number(consumption) || 0,
      actualConsumption: Number(actualConsumption) || 0,
      projectedConsumption: Number(projectedConsumption) || 0,
      currentStock: Number(currentStock) || 0,
      facilityIndentQty: Number(facilityIndentQty) || 0,
      rate: Number(rate) || 0,
      anualIndentId: Number(anualIndentId)
    }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error updating Create Indent Item:', error);
    throw error;
  }
}

// Delete single item row in anualindent
async function deleteCreateIndentItem(anualIndentId) {
  try {
    const query = `delete from anualindent where anualindentid = :anualIndentId`;
    await db.execute(query, { anualIndentId: Number(anualIndentId) }, { autoCommit: true });
    return true;
  } catch (error) {
    console.error('Error deleting Create Indent Item:', error);
    throw error;
  }
}

// Generate Annual Indent Header (lbtnUpdateSOInfo_Click)
async function generateIndentHeader(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const catId = categoryId ? Number(categoryId) : null;

    // Check facility type to see if it's Medical College / DME
    const facTypeRes = await db.execute(
      `select facilitytypeid from masfacilities where facilityid = :facId`,
      { facId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const facTypeId = facTypeRes.rows && facTypeRes.rows[0] ? String(facTypeRes.rows[0].FACILITYTYPEID || facTypeRes.rows[0].facilitytypeid) : '';

    let supplierCode = 'AI';
    if (facTypeId === '364' || facTypeId === '378' || facTypeId === '368') {
      const aiTypeCheck = await db.execute(
        `select count(indentid) cnt from masanualindent where nonedlindenttype is null and isreagent is null and facilityid = :facId and accyrsetid = :fyId and status = 'C' and isrevise is null`,
        { facId, fyId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (aiTypeCheck.rows && aiTypeCheck.rows[0] && Number(aiTypeCheck.rows[0].CNT || aiTypeCheck.rows[0].cnt) > 0) {
        supplierCode = 'RI';
      }
    }

    // Get year code
    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '26-27') : '26-27';

    // Auto generate code: facId/supplierCode00001/shYear
    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/${supplierCode}${codeStr}/${shYear}`;

    // Get Next Indent ID
    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    const isRevise = supplierCode === 'RI' ? 'Y' : null;
    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode, AIcategoryid, isrevise)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, :catId, :isRevise)
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode, catId, isRevise }, { autoCommit: true });

    let categoryName = '';
    if (catId) {
      const catQuery = `
        select coalesce(
          (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = :catId),
          (select categoryname from masitemcategories where categoryid = :catId),
          'General'
        ) as catname from dual
      `;
      const catRes = await db.execute(catQuery, { catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (catRes.rows && catRes.rows.length > 0) {
        categoryName = catRes.rows[0].CATNAME || catRes.rows[0].catname || '';
      }
    }

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      categoryId: catId,
      categoryName,
      exists: true
    };
  } catch (error) {
    console.error('Error generating Indent Header:', error);
    throw error;
  }
}

// Freeze / Finalize Indent (btnFreez_Click)
async function freezeIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `update masAnualIndent set status='C', indentdate=sysdate, entrydate=sysdate, freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C', freezdatetime=sysdate where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Indent:', error);
    throw error;
  }
}

// Delete whole Annual Indent (btndelete_Click)
async function deleteIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Indent:', error);
    throw error;
  }
}

// Fetch Dropdown options for Medical College AI (MC_AI.aspx)
async function getMedicalCollegeAiDropdowns() {
  try {
    const finQuery = `select accyrsetid, accyear from masAccYearSettings where accyrsetid > 534 order by accyrsetid desc`;
    const mcQuery = `select facilityid, facilityname from masfacilities where facilitytypeid = 364 and isactive = 1 order by facilityname`;
    const catQuery = `select categoryid, categoryname from masitemcategories where categoryid IN (52, 54, 53) order by categoryname`;

    const finRes = await db.execute(finQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const mcRes = await db.execute(mcQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const catRes = await db.execute(catQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return {
      finYears: (finRes.rows || []).map(r => ({ accYrSetId: r.ACCYRSETID || r.accYrSetId, accYear: r.ACCYEAR || r.accYear })),
      medicalColleges: (mcRes.rows || []).map(r => ({ facilityId: r.FACILITYID || r.facilityId, facilityName: r.FACILITYNAME || r.facilityName })),
      categories: (catRes.rows || []).map(r => ({ categoryId: r.CATEGORYID || r.categoryId, categoryName: r.CATEGORYNAME || r.categoryName }))
    };
  } catch (error) {
    console.error('Error fetching Medical College AI dropdowns:', error);
    throw error;
  }
}

// Fetch Report Data for Medical College AI (MC_AI.aspx)
async function getMedicalCollegeAiReport(finYearId, medicalCollegeId, categoryId) {
  try {
    const fyId = Number(finYearId) || 547;
    const facId = Number(medicalCollegeId) || 23416;
    const catId = Number(categoryId) || 52;

    const reportQuery = `
      select m.itemcode, m.itemname, m.strength1, m.unit, m.unitcount,
             nvl(i.bram_rpr, 0) as AI,
             nvl(fac.inhand_qty, 0) facstock,
             case when m.rateSourch is not null and r.status is null then m.aprxrate
                  else (case when r.basicrate is not null then r.basicrate 
                             else case when r.basicrate is null and pr.rate is not null then pr.rate else pr.rate end 
                        end) 
             end as Rates,
             r.status,
             nvl(i.bram_rpr, 0) * (
                 case when m.rateSourch is not null and r.status is null then m.aprxrate
                      else (case when r.basicrate is not null then r.basicrate 
                                 else case when r.basicrate is null and pr.rate is not null then pr.rate else pr.rate end 
                            end) 
                 end
             ) as IValue,
             'Against AI' as AItype
      from masitems m
      inner join itemindent i on i.itemid = m.itemid and i.accyrsetid = :fyId
      left outer join FINALFACSTOCK fac on fac.edlitemcode = m.itemcode and fac.facilityid = :facId
      left outer join (
          select r.itemid, min(basicrate) as basicrate, status 
          from v_rcvalid r  
          group by r.itemid, status
      ) r on r.itemid = m.itemid
      left outer join v_previousrate pr on pr.itemid = m.itemid
      where m.categoryid = :catId
      order by m.itemcode
    `;

    const result = await db.execute(reportQuery, { fyId, facId, catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    return rows.map((r, idx) => ({
      sNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      unitCount: r.UNITCOUNT || r.unitCount || 1,
      aiQty: r.AI || r.ai || 0,
      facStock: r.FACSTOCK || r.facStock || 0,
      rates: Number(r.RATES || r.rates || 0).toFixed(2),
      status: r.STATUS || r.status || '-',
      iValue: Number(r.IVALUE || r.iValue || 0).toFixed(2),
      aiType: r.AITYPE || r.aiType || 'Against AI'
    }));
  } catch (error) {
    console.error('Error fetching Medical College AI Report:', error);
    throw error;
  }
}

// Fetch Dropdown options for MC / Hospital AI vs Issuance Report (AIvsIssueanceRpt.aspx)
async function getMcAiVsIssuanceDropdowns() {
  try {
    const finQuery = `select accyrsetid, accyear from masAccYearSettings where accyrsetid > 537 order by accyrsetid desc`;
    const catQuery = `select categoryid, categoryname from masitemcategories where categoryid not in (58,59,60,61) order by categoryname`;
    const facQuery = `select facilityid, facilityname from masfacilities where facilitytypeid in (378,364) and facilityid not in (23496,23495,23695) order by facilityname`;

    const finRes = await db.execute(finQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const catRes = await db.execute(catQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const facRes = await db.execute(facQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return {
      indentYears: (finRes.rows || []).map(r => ({ accYrSetId: r.ACCYRSETID || r.accYrSetId, accYear: r.ACCYEAR || r.accYear })),
      categories: (catRes.rows || []).map(r => ({ categoryId: r.CATEGORYID || r.categoryId, categoryName: r.CATEGORYNAME || r.categoryName })),
      facilities: (facRes.rows || []).map(r => ({ facilityId: r.FACILITYID || r.facilityId, facilityName: r.FACILITYNAME || r.facilityName }))
    };
  } catch (error) {
    console.error('Error fetching MC AI vs Issuance dropdowns:', error);
    throw error;
  }
}

// Fetch Report Data for MC / Hospital AI vs Issuance Report (AIvsIssueanceRpt.aspx)
async function getMcAiVsIssuanceReport(finYearId, categoryId, facilityId) {
  try {
    const fyId = Number(finYearId) || 547;
    const catId = Number(categoryId) || 0;
    const facId = Number(facilityId) || 23416;

    const reportQuery = `
      select m.itemid, m.itemcode, m.itemname, m.strength1, m.unit, m.unitcount,
             a.ai, nvl(iss.ISS_Qty,0) as IssuedQTY,
             case when nvl(iss.ISS_Qty,0)>0 then Round(nvl(iss.ISS_Qty,0)/nvl(a.ai,1)*100, 2) else 0 end as IssuePEr,
             a.facilityid
      from V_InstitutionAI a
      inner join masitems m on m.itemid = a.itemid
      left outer join (
          select sum(tbo.issueqty) ISS_Qty, f.facilityid, tbi.itemid 
          from tbindents tb
          inner join tbindentitems tbi on tbi.indentid = tb.indentid 
          inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
          inner join tbreceiptbatches rb on rb.inwno = tbo.inwno
          inner join maswarehouses w on w.warehouseid = tb.warehouseid
          inner join masfacilities f on f.facilityid = tb.facilityid 
          where tb.Status = 'C' and tb.issuetype = 'NO' and f.facilitytypeid in (364,378)
            and tb.indentdate between (select startdate from masaccyearsettings where accyrsetid = :fyId)  
                                  and (select enddate from masaccyearsettings where accyrsetid = :fyId)  
            and tb.notindpdmis is null and tbi.notindpdmis is null and tbo.notindpdmis is null and rb.notindpdmis is null
          group by f.facilityid, tbi.itemid
      ) iss on iss.itemid = m.itemid and iss.facilityid = a.facilityid
      where 1=1 
        and (:catId = 0 or m.categoryid = :catId)
        and a.facilityid = :facId
        and a.accyrsetid = :fyId 
        and a.AI > 0 
      order by (case when nvl(iss.ISS_Qty,0)>0 then Round(nvl(iss.ISS_Qty,0)/nvl(a.ai,1)*100,2) else 0 end) desc
    `;

    const result = await db.execute(reportQuery, { fyId, catId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    return rows.map((r, idx) => ({
      sNo: idx + 1,
      itemId: r.ITEMID || r.itemId,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      unitCount: r.UNITCOUNT || r.unitCount || 1,
      ai: r.AI || r.ai || 0,
      issuedQty: r.ISSUEDQTY || r.issuedQty || 0,
      issuePer: Number(r.ISSUEPER || r.issuePer || 0).toFixed(2),
      facilityId: r.FACILITYID || r.facilityId
    }));
  } catch (error) {
    console.error('Error fetching MC AI vs Issuance Report:', error);
    throw error;
  }
}

// Bulk Save/Insert/Update items from uploaded Excel into anualindent table
async function uploadExcelIndentItems(facilityId, finYearId, indentId, items) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!indId || indId === 0) {
      throw new Error('Invalid Indent ID for Excel Upload');
    }

    // Clean up any 0 or null quantity rows for this indent
    await db.execute(
      `delete from anualindent where indentid = :indId and (facilityindentqty is null or facilityindentqty <= 0)`,
      { indId },
      { autoCommit: true }
    );

    if (!Array.isArray(items) || items.length === 0) {
      return { count: 0 };
    }

    let updatedCount = 0;
    for (const item of items) {
      const code = String(item.itemCode || '').trim();
      if (!code) continue;

      const rawQty = Number(item.facilityIndentQty) || 0;
      if (rawQty <= 0) {
        // IGNORE items with Annual Indent Qty <= 0
        continue;
      }

      const itemQuery = `
        select m.itemid, nvl(m.unitcount, 1) unitcount, nvl(vr.singlerate, 0) rate 
        from masitems m 
        left outer join v_itemrate vr on vr.itemid = m.itemid 
        where upper(m.itemcode) = upper(:code) and rownum = 1
      `;
      const itemRes = await db.execute(itemQuery, { code }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!itemRes.rows || itemRes.rows.length === 0) continue;

      const itemId = itemRes.rows[0].ITEMID || itemRes.rows[0].itemid;
      const unitCount = Number(itemRes.rows[0].UNITCOUNT || itemRes.rows[0].unitcount || 1);
      const rate = Number(item.rate) > 0 ? Number(item.rate) : Number(itemRes.rows[0].RATE || itemRes.rows[0].rate || 0);
      const cons = Number(item.consumption) || 0;
      const actCons = Number(item.actualConsumption) || 0;
      const projCons = Number(item.projectedConsumption) || 0;
      const stock = Number(item.currentStock) || 0;

      // Calculate fin indent qty matching C# logic
      let qty = rawQty;
      if (unitCount > 1) {
        const skuIndent = Math.floor(rawQty / unitCount);
        qty = skuIndent > 0 ? skuIndent * unitCount : rawQty;
      }

      const checkQuery = `
        select anualindentid 
        from anualindent 
        where indentid = :indId and itemid = :itemId
      `;
      const checkRes = await db.execute(checkQuery, { indId, itemId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      if (checkRes.rows && checkRes.rows.length > 0) {
        const anualIndentId = checkRes.rows[0].ANUALINDENTID || checkRes.rows[0].anualIndentId;
        const updateQuery = `
          update anualindent 
          set facilityindentqty = :qty,
              consumption = :cons,
              actualconsumption = :actCons,
              projectedconsumption = :projCons,
              currentstock = :stock,
              rate = :rate
          where anualindentid = :anualIndentId
        `;
        await db.execute(updateQuery, { qty, cons, actCons, projCons, stock, rate, anualIndentId }, { autoCommit: true });
        updatedCount++;
      } else {
        const idQuery = `select nvl(max(anualindentid), 0) + 1 as nextid from anualindent`;
        const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const nextId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

        const insertQuery = `
          insert into anualindent 
          (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, facilityindentqty, consumption, actualconsumption, projectedconsumption, currentstock, rate, status, entrydate)
          values
          (:nextId, :indId, :facId, :itemId, :code, :fyId, :qty, :cons, :actCons, :projCons, :stock, :rate, 'I', sysdate)
        `;
        await db.execute(insertQuery, { nextId, indId, facId, itemId, code, fyId, qty, cons, actCons, projCons, stock, rate }, { autoCommit: true });
        updatedCount++;
      }
    }

    return { count: updatedCount };
  } catch (error) {
    console.error('Error in uploadExcelIndentItems:', error);
    throw error;
  }
}

// Fetch Reagent Upload & Forward List (REAGENTAnualindentMain.aspx)
async function getReagentUploadForwardList(facilityId, finYearId, status) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    let statusClause = '';
    if (status && status !== 'All') {
      statusClause = `and a.Status = '${status}'`;
    }

    const query = `
      select null as SlNo,
             a.DispatchNo,
             to_char(a.DispatchDate, 'dd-mm-yyyy') as DispatchDate,
             a.indentid as NOCID,
             a.indentno as NOCNumber,
             to_char(a.indentdate, 'dd-mm-yyyy') as NOCDATE,
             CASE a.Status
               WHEN 'I' THEN 'Incomplete'
               WHEN 'S' THEN 'Sent for Approval'
               WHEN 'C' THEN 'Completed'
               WHEN 'D' THEN 'Deleted'
               ELSE a.Status
             END as status,
             c.AccYear,
             a.facilityID,
             a.AccYrSetID
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.NONEDLIndentType = 'Y'
        and a.isReagent = 'Y'
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId
        ${statusClause}
      order by a.indentdate desc
    `;

    const result = await db.execute(query, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const list = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      dispatchNo: r.DISPATCHNO || r.dispatchno || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchdate || '-',
      nocId: r.NOCID || r.nocid || 0,
      indentId: r.NOCID || r.nocid || 0,
      nocNumber: r.NOCNUMBER || r.nocnumber || '-',
      nocDate: r.NOCDATE || r.nocdate || '-',
      status: r.STATUS || r.status || '-',
      accYear: r.ACCYEAR || r.accyear || '-',
      accYrSetId: r.ACCYRSETID || r.accyrsetid || fyId,
      categoryName: 'REAGENT',
      facilityId: r.FACILITYID || r.facilityid
    }));

    // CheckAnualindent: if count > 0 then cannot add fresh
    const checkQuery = `
      select count(indentid) as cnt
      from masanualindent
      where NONEDLIndentType = 'Y'
        and isReagent = 'Y'
        and facilityid = :facId
        and accyrsetid = :fyId
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const cnt = checkRes.rows && checkRes.rows[0] ? Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) : 0;
    const canAdd = cnt === 0;

    return { list, canAdd };
  } catch (error) {
    console.error('Error in getReagentUploadForwardList:', error);
    throw error;
  }
}

// Fetch Reagent Create Indent Header
async function getReagentCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const q = `
        select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
               a.status, a.accyrsetid, c.accyear
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          indentId: row.INDENTID || row.indentid,
          indentNo: row.INDENTNO || row.indentno,
          indentDate: row.INDENTDATE || row.indentdate,
          status: row.STATUS || row.status || 'I',
          accYear: row.ACCYEAR || row.accyear || '',
          exists: true
        };
      }
    }

    const checkQuery = `
      select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
             a.status, a.accyrsetid, c.accyear
      from masAnualIndent a
      left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
      where a.NONEDLIndentType = 'Y'
        and a.isReagent = 'Y'
        and a.facilityid = :facId
        and a.accyrsetid = :fyId
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && checkRes.rows.length > 0) {
      const row = checkRes.rows[0];
      return {
        indentId: row.INDENTID || row.indentid,
        indentNo: row.INDENTNO || row.indentno,
        indentDate: row.INDENTDATE || row.indentdate,
        status: row.STATUS || row.status || 'I',
        accYear: row.ACCYEAR || row.accyear || '',
        exists: true
      };
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: 'System Generated',
      status: 'N',
      accYear: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Reagent Indent Header:', error);
    throw error;
  }
}

// Generate Reagent Indent Header (lbtnUpdateSOInfo_Click in REAGENTAnualItemIndent.aspx.cs)
async function generateReagentIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const checkQuery = `
      select count(indentid) as cnt
      from masAnualIndent
      where NONEDLIndentType = 'Y' and isReagent = 'Y'
        and AccYrSetID = :fyId and FacilityId = :facId
    `;
    const checkRes = await db.execute(checkQuery, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) > 0) {
      return await getReagentCreateIndentHeader(facId, fyId, 0);
    }

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '26-27') : '26-27';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/RG${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType, isReagent)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y', 'Y')
    `;
    await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      exists: true
    };
  } catch (error) {
    console.error('Error generating Reagent Indent Header:', error);
    throw error;
  }
}

// Fetch Reagent Indent Items and Summary (PopulateData & FillAIValue in REAGENTAnualItemIndent.aspx.cs)
async function getReagentCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    const query = `
      select 0 as SlNo,
             a.ANUALINDENTID,
             a.itemid,
             g.groupname,
             a.consumption,
             a.currentstock,
             a.facilityindentqty,
             a.status as flag,
             nvl(a.Rate, 0) as Rate,
             a.facilityindentqty * nvl(a.Rate, 0) as indAprVal,
             m.ItemCode,
             m.ItemName,
             m.Strength1,
             m.Unit,
             m.PackingQty,
             b.ItemTypeCode
      from masanualindent ma
      inner join anualindent a on a.indentid = ma.indentid
      inner join masitems m on a.itemid = m.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemcategories mt on mt.categoryid = m.categoryid
      left outer join masItemTypes b on b.ItemTypeID = m.ItemTypeID
      where ma.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
        and ma.NONEDLIndentType = 'Y'
        and ma.isReagent = 'Y'
        and ma.facilityid = :facId
        and ma.accyrsetid = :fyId
      order by m.itemname
    `;

    const result = await db.execute(query, { indId, facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const items = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '',
      itemName: r.ITEMNAME || r.itemname || '',
      strength1: r.STRENGTH1 || r.strength1 || '',
      unit: r.UNIT || r.unit || 'NOS',
      packingQty: r.PACKINGQTY || r.packingqty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemtypecode || '',
      groupName: r.GROUPNAME || r.groupname || '',
      consumption: Number(r.CONSUMPTION !== undefined ? r.CONSUMPTION : 0),
      currentStock: Number(r.CURRENTSTOCK !== undefined ? r.CURRENTSTOCK : 0),
      facilityIndentQty: Number(r.FACILITYINDENTQTY !== undefined ? r.FACILITYINDENTQTY : 0),
      rate: Number(r.RATE !== undefined ? r.RATE : 0),
      indAprVal: Number(r.INDAPRVAL !== undefined ? r.INDAPRVAL : 0),
      flag: r.FLAG || r.flag || 'I'
    }));

    const summaryQuery = `
      select a.indentid,
             count(distinct ai.itemid) as cntIte,
             round(sum(nvl(ai.FACILITYINDENTQTY, 0) * nvl(ai.Rate, 0)) / 10000000, 2) as indVal
      from masanualindent a
      inner join anualindent ai on ai.indentid = a.indentid
      where a.indentid = :indId
        and nvl(ai.FACILITYINDENTQTY, 0) > 0
      group by a.indentid
    `;
    const sumRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = items.length;
    let aproxIndentValue = '0.00';
    if (sumRes.rows && sumRes.rows.length > 0) {
      noOfItems = Number(sumRes.rows[0].CNTITE || sumRes.rows[0].cntite || items.length);
      aproxIndentValue = Number(sumRes.rows[0].INDVAL || sumRes.rows[0].indval || 0).toFixed(2);
    }

    return { items, noOfItems, aproxIndentValue };
  } catch (error) {
    console.error('Error in getReagentCreateIndentItems:', error);
    throw error;
  }
}

// Upload Excel Reagent Indent Items (btnupload_Click in REAGENTAnualItemIndent.aspx.cs)
async function uploadExcelReagentIndentItems(facilityId, finYearId, indentId, rows) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!indId || indId <= 0) {
      throw new Error('Please Generate Indent Number First then Upload File.');
    }

    let insertedCount = 0;
    for (const r of rows) {
      const code = String(r.itemcode || r.itemCode || '').trim();
      if (!code) continue;

      const rawQty = r.facilityIndentQty ?? r.nonEdlIndent ?? r.nonEdlIndent2728 ?? r.nonEdlIndent2627 ?? r.Non_EDL_INDENT_27_28 ?? r.Non_EDL_INDENT_26_27 ?? 0;
      const qty = Number(rawQty) || 0;
      const rate = Number(r.rate || r.Rate || 0);

      if (qty > 0) {
        if (rate <= 0) {
          throw new Error(`Rate should not be empty for item: ${code}`);
        }
      } else {
        continue;
      }

      const rawCons = r.consumption ?? r.consumptionFrom1Apr ?? r.consumptionFrom1Apr25 ?? r.COSUMPTION_From_1APR_26 ?? r.COSUMPTION_From_1APR_25 ?? 0;
      const cons = Number(rawCons) || 0;
      const stock = Number(r.currentStock !== undefined ? r.currentStock : (r.Current_Stock || 0));

      const itemRes = await db.execute(`select itemid from masitems where itemcode = :code`, { code }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!itemRes.rows || itemRes.rows.length === 0) continue;
      const itemId = itemRes.rows[0].ITEMID || itemRes.rows[0].itemid;

      const dupRes = await db.execute(
        `select count(itemcode) as cnt from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId and itemcode = :code`,
        { indId, facId, fyId, code },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const isDup = Number(dupRes.rows[0].CNT || dupRes.rows[0].cnt || 0) > 0;

      if (!isDup) {
        const idRes = await db.execute(`select nvl(max(anualindentid), 0) + 1 as nextid from anualindent`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const nextId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

        const insertQuery = `
          insert into anualindent
          (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, consumption, currentstock, facilityindentqty, status, Rate, entrydate)
          values
          (:nextId, :indId, :facId, :itemId, :code, :fyId, :cons, :stock, :qty, 'I', :rate, sysdate)
        `;
        await db.execute(insertQuery, { nextId, indId, facId, itemId, code, fyId, cons, stock, qty, rate }, { autoCommit: true });
        insertedCount++;
      } else {
        const updateQuery = `
          update anualindent
          set consumption = :cons, currentstock = :stock, facilityindentqty = :qty, rate = :rate
          where indentid = :indId and facilityid = :facId and accyrsetid = :fyId and itemcode = :code
        `;
        await db.execute(updateQuery, { cons, stock, qty, rate, indId, facId, fyId, code }, { autoCommit: true });
        insertedCount++;
      }
    }

    return { count: insertedCount };
  } catch (error) {
    console.error('Error in uploadExcelReagentIndentItems:', error);
    throw error;
  }
}

// Freeze Reagent Indent (btnFreez_Click in REAGENTAnualItemIndent.aspx.cs)
async function freezeReagentIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', entrydate=sysdate, indentdate=sysdate, freezdatetime=sysdate where NONEDLIndentType='Y' and isReagent='Y' and indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C' where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Reagent Indent:', error);
    throw error;
  }
}

// Delete Reagent Indent (btndelete_Click in REAGENTAnualItemIndent.aspx.cs)
async function deleteReagentIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where NONEDLIndentType='Y' and isReagent='Y' and indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Reagent Indent:', error);
    throw error;
  }
}

// Fetch Non-EDL Create Indent Header (NONEDLAnualItemIndent.aspx.cs)
async function getNonEdlCreateIndentHeader(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    if (indId > 0) {
      const q = `
        select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
               a.status, a.accyrsetid, c.accyear
        from masAnualIndent a
        left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          indentId: row.INDENTID || row.indentid,
          indentNo: row.INDENTNO || row.indentno,
          indentDate: row.INDENTDATE || row.indentdate,
          status: row.STATUS || row.status || 'I',
          accYear: row.ACCYEAR || row.accyear || '',
          exists: true
        };
      }
    }

    const checkQuery = `
      select a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') as indentdate,
             a.status, a.accyrsetid, c.accyear
      from masAnualIndent a
      left outer join masaccyearsettings c on c.accyrsetid = a.accyrsetid
      where a.NONEDLIndentType = 'Y'
        and a.isReagent is null
        and a.facilityid = :facId
        and a.accyrsetid = :fyId
    `;
    const checkRes = await db.execute(checkQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (checkRes.rows && checkRes.rows.length > 0) {
      const row = checkRes.rows[0];
      return {
        indentId: row.INDENTID || row.indentid,
        indentNo: row.INDENTNO || row.indentno,
        indentDate: row.INDENTDATE || row.indentdate,
        status: row.STATUS || row.status || 'I',
        accYear: row.ACCYEAR || row.accyear || '',
        exists: true
      };
    }

    return {
      indentId: 0,
      indentNo: 'AUTO GENERATED',
      indentDate: 'System Generated',
      status: 'N',
      accYear: '',
      exists: false
    };
  } catch (error) {
    console.error('Error fetching Non-EDL Indent Header:', error);
    throw error;
  }
}

// Generate Non-EDL Indent Header (lbtnUpdateSOInfo_Click in NONEDLAnualItemIndent.aspx.cs)
async function generateNonEdlIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;

    const checkQuery = `
      select count(indentid) as cnt
      from masAnualIndent
      where NONEDLIndentType = 'Y' and isReagent is null
        and AccYrSetID = :fyId and FacilityId = :facId
    `;
    const checkRes = await db.execute(checkQuery, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const isDup = checkRes.rows && Number(checkRes.rows[0].CNT || checkRes.rows[0].cnt || 0) > 0;

    const yrQuery = `select shaccyear from masAccYearSettings where accyrsetid = :fyId`;
    const yrRes = await db.execute(yrQuery, { fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const shYear = yrRes.rows && yrRes.rows[0] ? (yrRes.rows[0].SHACCYEAR || yrRes.rows[0].shaccyear || '27-28') : '27-28';

    const seqQuery = `select nvl(max(auto_aicode), 0) + 1 as nextcode from masAnualIndent where facilityid = :facId and accyrsetid = :fyId`;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/NE${codeStr}/${shYear}`;

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    if (isDup) {
      const insertQuery = `
        insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType, isrevise)
        values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y', 'Y')
      `;
      await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });
    } else {
      const insertQuery = `
        insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, AUTO_AICODE, NONEDLIndentType)
        values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, 'Y')
      `;
      await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode }, { autoCommit: true });
    }

    return {
      indentId,
      indentNo,
      indentDate: new Date().toLocaleDateString('en-GB'),
      status: 'I',
      exists: true
    };
  } catch (error) {
    console.error('Error generating Non-EDL Indent Header:', error);
    throw error;
  }
}

// Fetch Non-EDL Indent Items and Summary (PopulateData & FillAIValue in NONEDLAnualItemIndent.aspx.cs)
async function getNonEdlCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    const query = `
      select 0 as SlNo,
             a.ANUALINDENTID,
             a.itemid,
             g.groupname,
             a.consumption,
             a.currentstock,
             a.facilityindentqty,
             a.status as flag,
             nvl(a.Rate, 0) as Rate,
             a.facilityindentqty * nvl(a.Rate, 0) as indAprVal,
             m.ItemCode,
             m.ItemName,
             m.Strength1,
             m.Unit,
             m.PackingQty,
             b.ItemTypeCode
      from masanualindent ma
      inner join anualindent a on a.indentid = ma.indentid
      inner join masitems m on a.itemid = m.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemcategories mt on mt.categoryid = m.categoryid
      left outer join masItemTypes b on b.ItemTypeID = m.ItemTypeID
      where ma.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
        and ma.NONEDLIndentType = 'Y'
        and ma.isReagent is null
        and m.categoryid in (52, 53, 54, 55, 56, 63, 65, 66)
        and ma.facilityid = :facId
        and ma.accyrsetid = :fyId
      order by m.itemname
    `;

    const result = await db.execute(query, { indId, facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const items = (result.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '',
      itemName: r.ITEMNAME || r.itemname || '',
      strength1: r.STRENGTH1 || r.strength1 || '',
      unit: r.UNIT || r.unit || 'NOS',
      packingQty: r.PACKINGQTY || r.packingqty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemtypecode || '',
      groupName: r.GROUPNAME || r.groupname || '',
      consumption: Number(r.CONSUMPTION !== undefined ? r.CONSUMPTION : 0),
      currentStock: Number(r.CURRENTSTOCK !== undefined ? r.CURRENTSTOCK : 0),
      facilityIndentQty: Number(r.FACILITYINDENTQTY !== undefined ? r.FACILITYINDENTQTY : 0),
      rate: Number(r.RATE !== undefined ? r.RATE : 0),
      indAprVal: Number(r.INDAPRVAL !== undefined ? r.INDAPRVAL : 0),
      flag: r.FLAG || r.flag || 'I'
    }));

    const summaryQuery = `
      select a.indentid,
             count(distinct ai.itemid) as cntIte,
             round(sum(nvl(ai.FACILITYINDENTQTY, 0) * nvl(ai.Rate, 0)) / 10000000, 2) as indVal
      from masanualindent a
      inner join anualindent ai on ai.indentid = a.indentid
      where a.indentid = :indId
        and nvl(ai.FACILITYINDENTQTY, 0) > 0
      group by a.indentid
    `;
    const sumRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = items.length;
    let aproxIndentValue = '0.00';
    if (sumRes.rows && sumRes.rows.length > 0) {
      noOfItems = Number(sumRes.rows[0].CNTITE || sumRes.rows[0].cntite || items.length);
      aproxIndentValue = Number(sumRes.rows[0].INDVAL || sumRes.rows[0].indval || 0).toFixed(2);
    }

    return { items, noOfItems, aproxIndentValue };
  } catch (error) {
    console.error('Error in getNonEdlCreateIndentItems:', error);
    throw error;
  }
}

// Upload Excel Non-EDL Indent Items (btnupload_Click in NONEDLAnualItemIndent.aspx.cs)
async function uploadExcelNonEdlIndentItems(facilityId, finYearId, indentId, rows) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    if (!indId || indId <= 0) {
      throw new Error('Please Generate Indent Number First then Upload File.');
    }

    let insertedCount = 0;
    for (const r of rows) {
      const code = String(r.itemcode || r.itemCode || '').trim();
      if (!code) continue;

      const rawQty = r.facilityIndentQty ?? r.nonEdlIndent ?? r.nonEdlIndent2728 ?? r.nonEdlIndent2627 ?? r.Non_EDL_INDENT_27_28 ?? r.Non_EDL_INDENT_26_27 ?? 0;
      const qty = Number(rawQty) || 0;
      const rate = Number(r.rate || r.Rate || 0);

      if (qty > 0) {
        if (rate <= 0) {
          throw new Error(`Rate should not be empty for item: ${code}`);
        }
      } else {
        continue;
      }

      const rawCons = r.consumption ?? r.consumptionFrom1Apr ?? r.consumptionFrom1Apr25 ?? r.COSUMPTION_From_1APR_26 ?? r.COSUMPTION_From_1APR_25 ?? 0;
      const cons = Number(rawCons) || 0;
      const stock = Number(r.currentStock !== undefined ? r.currentStock : (r.Current_Stock || 0));

      // getItemID(drugcode)
      const itemRes = await db.execute(
        `Select ItemID, nvl(unitcount, 1) as unitcount from masItems where ISFREEZ_ITPR is null and (nvl(EDL2025FLAG,'N')='N' or EDL2025FLAG='DHS') and itemcode = :code`,
        { code },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!itemRes.rows || itemRes.rows.length === 0) continue;
      const itemId = itemRes.rows[0].ITEMID || itemRes.rows[0].itemid;
      const unitCount = Number(itemRes.rows[0].UNITCOUNT || itemRes.rows[0].unitcount || 1);

      // ItemExist(drugcode)
      const existRes = await db.execute(
        `Select ItemID from masItems where categoryid not in (62,59,61,58,60) and itemcode = :code`,
        { code },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!existRes.rows || existRes.rows.length === 0) continue;

      // SKU packaging calculation:
      let finQty = qty;
      if (unitCount > 1) {
        const skuIndent = Math.floor(qty / unitCount);
        finQty = skuIndent > 0 ? skuIndent * unitCount : qty;
      }

      const dupRes = await db.execute(
        `select count(itemcode) as cnt from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId and itemcode = :code`,
        { indId, facId, fyId, code },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const isDup = Number(dupRes.rows[0].CNT || dupRes.rows[0].cnt || 0) > 0;

      if (!isDup) {
        const idRes = await db.execute(`select nvl(max(anualindentid), 0) + 1 as nextid from anualindent`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const nextId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

        const insertQuery = `
          insert into anualindent
          (anualindentid, indentid, facilityid, itemid, itemcode, accyrsetid, consumption, currentstock, facilityindentqty, status, Rate, entrydate)
          values
          (:nextId, :indId, :facId, :itemId, :code, :fyId, :cons, :stock, :finQty, 'I', :rate, sysdate)
        `;
        await db.execute(insertQuery, { nextId, indId, facId, itemId, code, fyId, cons, stock, finQty, rate }, { autoCommit: true });
        insertedCount++;
      } else {
        const updateQuery = `
          update anualindent
          set consumption = :cons, currentstock = :stock, facilityindentqty = :finQty, rate = :rate
          where indentid = :indId and facilityid = :facId and accyrsetid = :fyId and itemcode = :code
        `;
        await db.execute(updateQuery, { cons, stock, finQty, rate, indId, facId, fyId, code }, { autoCommit: true });
        insertedCount++;
      }
    }

    return { count: insertedCount };
  } catch (error) {
    console.error('Error in uploadExcelNonEdlIndentItems:', error);
    throw error;
  }
}

// Freeze Non-EDL Indent (btnFreez_Click in NONEDLAnualItemIndent.aspx.cs)
async function freezeNonEdlIndent(facilityId, finYearId, indentId) {
  try {
    const indId = Number(indentId);
    const q1 = `update masAnualIndent set status='C', entrydate=sysdate, indentdate=sysdate, freezdatetime=sysdate where NONEDLIndentType='Y' and isReagent is null and indentid = :indId`;
    await db.execute(q1, { indId }, { autoCommit: true });

    const q2 = `update anualindent set status='C' where indentid = :indId`;
    await db.execute(q2, { indId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error freezing Non-EDL Indent:', error);
    throw error;
  }
}

// Delete Non-EDL Indent (btndelete_Click in NONEDLAnualItemIndent.aspx.cs)
async function deleteNonEdlIndent(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId);

    const q1 = `delete from anualindent where indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q1, { indId, facId, fyId }, { autoCommit: true });

    const q2 = `delete from masanualindent where NONEDLIndentType='Y' and isReagent is null and indentid = :indId and facilityid = :facId and accyrsetid = :fyId`;
    await db.execute(q2, { indId, facId, fyId }, { autoCommit: true });

    return true;
  } catch (error) {
    console.error('Error deleting Non-EDL Indent:', error);
    throw error;
  }
}

// Fetch Financial Years for Non-EDL Create Page (filters out years where indent is already created)
async function getNonEdlCreateFinYears(facilityId, mode, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const indId = Number(indentId) || 0;

    // If Edit mode with specific indentId: return that indent's financial year
    if (mode === 'Edit' && indId > 0) {
      const q = `
        select c.accyrsetid, c.accyear,
               case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
        from masAnualIndent a
        inner join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          accYrSetId: r.ACCYRSETID || r.accyrsetid,
          accYear: r.ACCYEAR || r.accyear,
          isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
        }));
      }
    }

    // In Create mode: query years where accyrsetid > 546 and no Non-EDL indent exists
    const query = `
      select c.accyrsetid, c.accyear,
             case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings c
      where c.accyrsetid > 546
        and c.accyrsetid not in (
          select distinct a.accyrsetid
          from masAnualIndent a
          where a.NONEDLIndentType = 'Y'
            and a.isReagent is null
            and a.facilityid = :facId
        )
      order by c.accyrsetid desc
    `;
    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching Non-EDL Create Fin Years:', error);
    throw error;
  }
}

// Fetch Financial Years for Reagent Create Page (filters out years where indent is already created)
async function getReagentCreateFinYears(facilityId, mode, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const indId = Number(indentId) || 0;

    if (mode === 'Edit' && indId > 0) {
      const q = `
        select c.accyrsetid, c.accyear,
               case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
        from masAnualIndent a
        inner join masaccyearsettings c on c.accyrsetid = a.accyrsetid
        where a.indentid = :indId
      `;
      const res = await db.execute(q, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          accYrSetId: r.ACCYRSETID || r.accyrsetid,
          accYear: r.ACCYEAR || r.accyear,
          isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
        }));
      }
    }

    const query = `
      select c.accyrsetid, c.accyear,
             case when sysdate between c.startdate and c.enddate then 'Y' else 'N' end as is_current
      from masaccyearsettings c
      where c.accyrsetid > 546
        and c.accyrsetid not in (
          select distinct a.accyrsetid
          from masAnualIndent a
          where a.NONEDLIndentType = 'Y'
            and a.isReagent = 'Y'
            and a.facilityid = :facId
        )
      order by c.accyrsetid desc
    `;
    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear,
      isCurrent: (r.IS_CURRENT || r.is_current) === 'Y'
    }));
  } catch (error) {
    console.error('Error fetching Reagent Create Fin Years:', error);
    throw error;
  }
}


// Fetch items for Annual Indent PDF download (for any Indent ID across EDL, Non-EDL, Reagent)
async function getIndentPdfItems(indentId) {
  try {
    const indId = Number(indentId) || 0;
    const query = `
      select 0 as SlNo,
             a.ANUALINDENTID,
             a.indentid,
             a.itemid,
             m.itemcode,
             m.itemname,
             m.strength1,
             m.unit,
             m.packingqty,
             b.itemtypecode,
             g.groupname,
             nvl(a.consumption, 0) as consumption,
             nvl(a.actualconsumption, 0) as actualconsumption,
             nvl(a.projectedconsumption, 0) as projectedconsumption,
             nvl(a.currentstock, 0) as currentstock,
             nvl(a.facilityindentqty, 0) as facilityindentqty,
             nvl(a.rate, 0) as rate,
             round(nvl(a.facilityindentqty, 0) * nvl(a.rate, 0), 2) as indaprval,
             a.status as flag
      from anualindent a
      inner join masitems m on m.itemid = a.itemid
      left outer join masitemgroups g on g.groupid = m.groupid
      left outer join masitemtypes b on b.itemtypeid = m.itemtypeid
      where a.indentid = :indId
        and nvl(a.facilityindentqty, 0) > 0
      order by m.itemname
    `;
    const res = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || 'NOS',
      packingQty: r.PACKINGQTY || r.packingqty || 1,
      itemTypeCode: r.ITEMTYPECODE || r.itemtypecode || '-',
      groupName: r.GROUPNAME || r.groupname || '-',
      consumption: Number(r.CONSUMPTION || 0),
      actualConsumption: Number(r.ACTUALCONSUMPTION || 0),
      projectedConsumption: Number(r.PROJECTEDCONSUMPTION || 0),
      currentStock: Number(r.CURRENTSTOCK || 0),
      facilityIndentQty: Number(r.FACILITYINDENTQTY || 0),
      rate: Number(r.RATE || 0),
      indAprVal: Number(r.INDAPRVAL || 0),
      flag: r.FLAG || r.flag || 'C'
    }));
  } catch (error) {
    console.error('Error fetching Indent PDF items:', error);
    throw error;
  }
}

/**
 * DAO Forwarded List - Main Page
 * Matches: DAOApprovalMas.aspx - PopulateSO()
 * Shows distinct categories with dispatch info for AYUSH facilities in DAO's district.
 * Uses GROUP BY (instead of DISTINCT) + filters DISPATCHNO IS NOT NULL to avoid
 * duplicate category rows from facilities without dispatch info.
 */
async function getDaoForwardedList(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    // Primary query — tries AYFACTYPEID filter (same as legacy)
    let query = `
      SELECT sc.CATNAME, sc.SUBCATID,
             MAX(a.DISPATCHNO)                               AS DISPATCHNO,
             to_char(MAX(a.DISPATCHDATE), 'dd-mm-yyyy')     AS DISPATCHDATE,
             MAX(mf.DISTRICTID)                             AS DISTRICTID
      FROM masAnualIndent a
      INNER JOIN masFacilities mf ON mf.FACILITYID = a.FACILITYID
      INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = a.AICATEGORYID
      WHERE a.STATUS       = 'C'
        AND mf.ISACTIVE    = 1
        AND mf.FACILITYTYPEID = 371
        AND a.DISPATCHNO IS NOT NULL
        AND a.ACCYRSETID   = :fyId
        AND mf.AYFACTYPEID NOT IN (11, 12, 13, 14)
        AND mf.DISTRICTID IN (
          SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
        )
      GROUP BY sc.CATNAME, sc.SUBCATID
      ORDER BY sc.CATNAME
    `;

    let res;
    try {
      res = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    } catch (colErr) {
      // Fallback: AYFACTYPEID column may not exist in all DB versions
      console.warn('getDaoForwardedList: AYFACTYPEID column missing, using fallback query:', colErr.message);
      const fallbackQuery = `
        SELECT sc.CATNAME, sc.SUBCATID,
               MAX(a.DISPATCHNO)                               AS DISPATCHNO,
               to_char(MAX(a.DISPATCHDATE), 'dd-mm-yyyy')     AS DISPATCHDATE,
               MAX(mf.DISTRICTID)                             AS DISTRICTID
        FROM masAnualIndent a
        INNER JOIN masFacilities mf ON mf.FACILITYID = a.FACILITYID
        INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = a.AICATEGORYID
        WHERE a.STATUS       = 'C'
          AND mf.ISACTIVE    = 1
          AND mf.FACILITYTYPEID = 371
          AND a.DISPATCHNO IS NOT NULL
          AND a.ACCYRSETID   = :fyId
          AND mf.DISTRICTID IN (
            SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
          )
        GROUP BY sc.CATNAME, sc.SUBCATID
        ORDER BY sc.CATNAME
      `;
      res = await db.execute(fallbackQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    }

    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      catName: r.CATNAME || r.catname || '',
      subCatId: r.SUBCATID || r.subcatid,
      dispatchNo: r.DISPATCHNO || r.dispatchno || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchdate || '-',
      districtId: r.DISTRICTID || r.districtid
    }));
  } catch (error) {
    console.error('Error fetching DAO forwarded list:', error);
    throw error;
  }
}

/**
 * DAO Detail Items - Detail Page (rptDAOApprovalAyush)
 * Aggregated item-wise indent details for a specific subcategory in the DAO's district
 */
async function getDaoDetailItems(facilityId, subCatId, finYearId) {
  try {
    const facId = Number(facilityId) || 0;
    const subId = Number(subCatId) || 0;
    const fyId = Number(finYearId) || 547;

    const query = `
      SELECT m.ITEMCODE, m.ITEMNAME, m.STRENGTH1, m.UNIT,
             sc.CATNAME || ' (' || c.CATEGORYNAME || ')' AS CATEGORYNAME,
             NVL(agg.FACILITYINDENTQTY, 0) AS FACILITYINDENTQTY,
             NVL(agg.CMHOAPPROVEDQTY, 0) AS DAOAPPROVEDQTY,
             NVL(agg.AYUSHAPRQTY, 0) AS AYUSHAPRQTY
      FROM masItems m
      INNER JOIN masItemCategories c ON c.CATEGORYID = m.CATEGORYID
      INNER JOIN MasSubItemCategory sc ON sc.SUBCATID = m.SUBCATID
      INNER JOIN (
        SELECT x.ITEMID,
               SUM(NVL(x.FACILITYINDENTQTY, 0)) AS FACILITYINDENTQTY,
               SUM(NVL(x.CMHOAPPROVEDQTY, 0)) AS CMHOAPPROVEDQTY,
               SUM(NVL(x.AYUSHAPRQTY, 0)) AS AYUSHAPRQTY
        FROM (
          SELECT ai.ITEMID, ai.FACILITYINDENTQTY, ai.CMHOAPPROVEDQTY, ai.AYUSHAPRQTY
          FROM masAnualIndent a
          INNER JOIN anualIndent ai ON ai.INDENTID = a.INDENTID
          INNER JOIN masFacilities f ON f.FACILITYID = a.FACILITYID
          WHERE f.ISACTIVE = 1
            AND f.FACILITYTYPEID = 371
            AND a.STATUS = 'C'
            AND f.DISTRICTID IN (
              SELECT DISTINCT DISTRICTID FROM masFacilities WHERE FACILITYID = :facId
            )
            AND a.ACCYRSETID = :fyId
        ) x
        GROUP BY x.ITEMID
      ) agg ON agg.ITEMID = m.ITEMID
      WHERE m.SUBCATID = :subId
      ORDER BY sc.CATNAME, m.ITEMCODE
    `;

    const res = await db.execute(query, { facId, fyId, subId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || '-',
      categoryName: r.CATEGORYNAME || r.categoryname || '-',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || 0),
      daoApprovedQty: Number(r.DAOAPPROVEDQTY || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO detail items:', error);
    throw error;
  }
}

async function getDaoApprovalList(facilityId, finYearId, categoryId, statusFilter) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;

    let query = `
      SELECT a.indentid, a.indentno, to_char(a.indentdate, 'dd-mm-yyyy') indentdate,
             a.facilityid, mf.facilityname, a.accyrsetid, c.accyear,
             coalesce(
               (select sub.catname || ' (' || mc2.categoryname || ')' 
                from massubitemcategory sub 
                inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid 
                where sub.subcatid = a.aicategoryid),
               mc.categoryname,
               'General'
             ) categoryname,
             CASE 
               WHEN a.Status = 'C' AND EXISTS (SELECT 1 FROM anualindent ai WHERE ai.indentid = a.indentid AND ai.isayushapproved = 'Y') THEN 'Approved'
               WHEN a.Status = 'C' THEN 'Forwarded for Approval'
               WHEN a.Status = 'S' THEN 'Sent for Approval'
               WHEN a.Status = 'I' THEN 'Incomplete'
               ELSE 'Forwarded for Approval'
             END as status,
             (SELECT COUNT(*) FROM anualindent ai WHERE ai.indentid = a.indentid AND NVL(ai.facilityindentqty, 0) > 0) as totalitems,
             (SELECT NVL(SUM(ai.facilityindentqty), 0) FROM anualindent ai WHERE ai.indentid = a.indentid) as totalqty,
             (SELECT NVL(SUM(CASE WHEN ai.isayushapproved = 'Y' THEN ai.ayushaprqty ELSE ai.facilityindentqty END), 0) FROM anualindent ai WHERE ai.indentid = a.indentid) as totalapprovedqty
      FROM masAnualIndent a
      JOIN masfacilities mf ON a.facilityid = mf.facilityid
      JOIN masaccyearsettings c ON a.accyrsetid = c.accyrsetid
      LEFT OUTER JOIN masitemcategories mc ON mc.categoryid = a.aicategoryid
      WHERE (mf.districtid = (SELECT districtid FROM masfacilities WHERE facilityid = :facId) OR mf.facilitytypeid = 371)
        AND a.accyrsetid = :fyId
        AND a.Status IN ('C', 'S')
    `;

    const binds = { facId, fyId };

    if (categoryId && categoryId !== '0' && categoryId !== 'All') {
      query += ` AND a.aicategoryid = :catId `;
      binds.catId = Number(categoryId);
    }

    query += ` ORDER BY a.indentdate DESC, a.indentid DESC `;

    const res = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let rows = res.rows || [];

    if (statusFilter && statusFilter !== 'All') {
      rows = rows.filter(r => (r.STATUS || '').toLowerCase().includes(statusFilter.toLowerCase()));
    }

    return rows.map((r, idx) => ({
      slNo: idx + 1,
      indentId: r.INDENTID || r.indentid,
      indentNo: r.INDENTNO || r.indentno,
      indentDate: r.INDENTDATE || r.indentdate,
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      accYear: r.ACCYEAR || r.accyear,
      categoryName: r.CATEGORYNAME || r.categoryname || 'General',
      status: r.STATUS || r.status || 'Forwarded for Approval',
      totalItems: Number(r.TOTALITEMS || r.totalitems || 0),
      totalQty: Number(r.TOTALQTY || r.totalqty || 0),
      totalApprovedQty: Number(r.TOTALAPPROVEDQTY || r.totalapprovedqty || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO approval list:', error);
    throw error;
  }
}

async function getDaoIndentItems(indentId) {
  try {
    const indId = Number(indentId);
    const query = `
      SELECT ai.anualindentid, ai.indentid, ai.itemid,
             m.itemcode, m.itemname, m.strengths, m.unit,
             nvl(ai.facilityindentqty, 0) as facilityindentqty,
             nvl(ai.currentstock, 0) as currentstock,
             nvl(ai.consumption, 0) as consumption,
             nvl(ai.ayushaprqty, ai.facilityindentqty) as ayushaprqty,
             nvl(ai.isayushapproved, 'N') as isayushapproved
      FROM anualindent ai
      JOIN masitems m ON ai.itemid = m.itemid
      WHERE ai.indentid = :indId
        AND nvl(ai.facilityindentqty, 0) > 0
      ORDER BY m.itemname
    `;

    const res = await db.execute(query, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      anualIndentId: r.ANUALINDENTID || r.anualindentid,
      indentId: r.INDENTID || r.indentid,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strengths: r.STRENGTHS || r.strengths || '-',
      unit: r.UNIT || r.unit || 'NOS',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || 0),
      currentStock: Number(r.CURRENTSTOCK || 0),
      consumption: Number(r.CONSUMPTION || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY !== null && r.AYUSHAPRQTY !== undefined ? r.AYUSHAPRQTY : r.FACILITYINDENTQTY || 0),
      isAyushApproved: r.ISAYUSHAPPROVED || r.isayushapproved || 'N'
    }));
  } catch (error) {
    console.error('Error fetching DAO indent items:', error);
    throw error;
  }
}

async function approveDaoIndent(indentId, userId, items) {
  let connection;
  try {
    connection = await db.getConnection();
    const indId = Number(indentId);
    const uId = Number(userId) || null;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemAiId = Number(item.anualIndentId);
        const aprQty = Number(item.ayushAprQty !== undefined ? item.ayushAprQty : item.facilityIndentQty);
        await connection.execute(
          `UPDATE anualindent 
           SET ayushaprqty = :aprQty, isayushapproved = 'Y', lastupdateddt = SYSDATE 
           WHERE anualindentid = :itemAiId AND indentid = :indId`,
          { aprQty, itemAiId, indId }
        );
      }
    } else {
      await connection.execute(
        `UPDATE anualindent 
         SET ayushaprqty = nvl(ayushaprqty, facilityindentqty), isayushapproved = 'Y', lastupdateddt = SYSDATE 
         WHERE indentid = :indId`,
        { indId }
      );
    }

    await connection.execute(
      `UPDATE masAnualIndent 
       SET approveddt = SYSDATE, approvedby = :uId, status = 'C' 
       WHERE indentid = :indId`,
      { uId, indId }
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    console.error('Error approving DAO indent:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) {}
    }
  }
}

async function getDaoStatusReport(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const catId = Number(categoryId) || 1;

    let whereclause = '';
    if (catId === 3 || catId === 4) {
      whereclause = ' and fta.FACTYPEID in (8,5,2) ';
    } else if (catId === 5 || catId === 6) {
      whereclause = ' and fta.FACTYPEID in (2) ';
    } else if (catId === 7) {
      whereclause = ' and fta.FACTYPEID in (2,13) ';
    } else if (catId === 8) {
      whereclause = ' ';
    } else {
      whereclause = ' and fta.FACTYPEID not in (5,13) ';
    }

    const query = `
      select 0 as SlNo, d.districtname, fta.FACTYPENAME, fm.facilityid, fm.facilityname,
             case 
               when ai.status = 'C' then 'Annual Indent Uploaded and Forwarded' 
               when ai.status = 'I' then 'Annual Indent Uploaded but not Forwarded' 
               else 'Indent Not Uploaded' 
             end as status,
             ai.AIcategoryid,
             nvl(sc.catname || ' (' || mc.categoryname || ')', (select sc2.catname || ' (' || mc2.categoryname || ')' from MasSubItemCategory sc2 inner join masitemcategories mc2 on mc2.categoryid=sc2.categoryid where sc2.subcatid=:catId)) as categoryname
      from masfacilities fm  
      left outer join (
        select facilityid, status, AIcategoryid 
        from masanualindent
        where accyrsetid = :fyId and AIcategoryid = :catId
      ) ai on ai.facilityid = fm.facilityid  
      inner join masdistricts d on d.districtid = fm.districtid
      inner join masfacilitytypes ft on ft.facilitytypeid = fm.facilitytypeid  
      inner join masfacilitytypeayush fta on fta.FACTYPEID = fm.AYFACTYPEID 
      left outer join MasSubItemCategory sc on sc.SUBCATID = ai.AIcategoryid 
      left outer join masitemcategories mc on mc.categoryid = sc.categoryid
      where fm.isactive = 1 
        ${whereclause}
        and fm.facilitytypeid = 371 
        and fm.districtid in (select districtid from masfacilities where facilityid = :facId) 
        and fm.facilityid not in (:facId) 
      order by ft.orderdp, fm.facilityname
    `;

    const res = await db.execute(query, { facId, fyId, catId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = res.rows || [];

    return rows.map((r, idx) => ({
      slNo: idx + 1,
      districtName: r.DISTRICTNAME || r.districtname || '',
      factypeName: r.FACTYPENAME || r.factypename || '',
      facilityId: r.FACILITYID || r.facilityid,
      facilityName: r.FACILITYNAME || r.facilityname,
      status: r.STATUS || r.status || 'Indent Not Uploaded',
      aiCategoryId: r.AICATEGORYID || r.aicategoryid || catId,
      categoryName: r.CATEGORYNAME || r.categoryname || ''
    }));
  } catch (error) {
    console.error('Error fetching DAO status report:', error);
    throw error;
  }
}

async function getDaoItemWiseAi(facilityId, finYearId, categoryId) {
  try {
    const facId = Number(facilityId) || 0;
    const fyId = Number(finYearId) || 547;
    const subCatId = Number(categoryId) || 0;

    let strFilter = '';
    const binds = { facId, fyId };

    if (subCatId > 0) {
      strFilter = ` and m.subcatid = :subCatId `;
      binds.subCatId = subCatId;
    }

    const query = `
      select m.itemid, m.itemcode, m.itemname, m.strength1, m.unit,
             sc.catname || ' (' || c.categoryname || ')' as categoryname,
             nvl(ai.facilityindentqty, 0) as facilityindentqty,
             nvl(ai.cmhoapprovedqty, 0) as daoapprovedqty,
             nvl(ai.ayushaprqty, 0) as ayushaprqty
      from masitems m 
      inner join masitemcategories c on c.categoryid = m.categoryid
      inner join MasSubItemCategory sc on sc.subcatid = m.subcatid
      inner join (
        select x.itemid,
               sum(nvl(facilityindentqty, 0)) as facilityindentqty,
               sum(nvl(cmhoapprovedqty, 0)) as cmhoapprovedqty,
               sum(nvl(ayushaprqty, 0)) as ayushaprqty
        from (
          select a.indentid, a.indentno, a.indentdate, a.facilityid, f.facilityname,
                 ai.itemid, ai.anualindentid, ai.facilityindentqty, ai.cmhoapprovedqty, ai.ayushaprqty
          from masanualindent a
          inner join anualindent ai on ai.indentid = a.indentid
          inner join masfacilities f on f.facilityid = a.facilityid
          where f.isactive = 1
            and f.facilitytypeid = 371
            and f.districtid in (select distinct districtid from masfacilities where facilityid = :facId)
            and a.status = 'C'
            and a.accyrsetid = :fyId
        ) x group by x.itemid
      ) ai on ai.itemid = m.itemid
      where 1=1 ${strFilter}
      order by sc.catname, m.itemcode
    `;

    const res = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows || []).map((r, idx) => ({
      slNo: idx + 1,
      itemId: r.ITEMID || r.itemid,
      itemCode: r.ITEMCODE || r.itemcode || '-',
      itemName: r.ITEMNAME || r.itemname || '-',
      strength: r.STRENGTH1 || r.strength1 || '-',
      unit: r.UNIT || r.unit || 'NOS',
      categoryName: r.CATEGORYNAME || r.categoryname || '',
      facilityIndentQty: Number(r.FACILITYINDENTQTY || r.facilityindentqty || 0),
      daoApprovedQty: Number(r.DAOAPPROVEDQTY || r.daoapprovedqty || 0),
      ayushAprQty: Number(r.AYUSHAPRQTY || r.ayushaprqty || 0)
    }));
  } catch (error) {
    console.error('Error fetching DAO item wise AI details:', error);
    throw error;
  }
}

module.exports = {
  getDaoForwardedList,
  getDaoDetailItems,
  getDaoApprovalList,
  getDaoIndentItems,
  approveDaoIndent,
  getDaoStatusReport,
  getDaoItemWiseAi,
  getIndentPdfItems,
  getNonEdlCreateFinYears,
  getReagentCreateFinYears,
  getIndentItems,
  getIndentSummary,
  getFacilityDistributions,
  insertDistribution,
  updateDistribution,
  deleteDistribution,
  getMcHospitalAiVsIssuance,
  getAyushDownloadFormatData,
  getDownloadAiFormatData,
  getIndentCategories,
  getDownloadNonEdlFormatData,
  getDownloadReagentNonEdlFormatData,
  getUploadForwardFinYears,
  getUploadForwardList,
  getNonEdlUploadForwardList,
  getNonEdlCreateIndentHeader,
  generateNonEdlIndentHeader,
  getNonEdlCreateIndentItems,
  uploadExcelNonEdlIndentItems,
  freezeNonEdlIndent,
  deleteNonEdlIndent,
  getReagentUploadForwardList,
  getReagentCreateIndentHeader,
  generateReagentIndentHeader,
  getReagentCreateIndentItems,
  uploadExcelReagentIndentItems,
  freezeReagentIndent,
  deleteReagentIndent,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  generateIndentHeader,
  freezeIndent,
  deleteIndent,
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport,
  uploadExcelIndentItems
};

