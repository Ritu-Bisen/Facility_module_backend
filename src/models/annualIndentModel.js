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

// Fetch Annual Indent Excel Download Format Data
async function getDownloadAiFormatData(facilityId) {
  try {
    const facId = Number(facilityId) || 22595;
    const query = `
      select 0 SlNo, Formate.itemcode, substr(Formate.itemname,1,100) as itemname, Formate.Formulation, substr(Formate.Strength,1,100) Strength, Formate.GroupName,
             Formate.edl, nvl(iss.FacIssueqty,0) as Issued_From_WH_01_Apr_25_to_31st_Oct_25, 0 as Actual_Consumption_From_01_April_25_to_31st_Oct_25, 
             0 as Estimated_Consumption_For_One_Year_From_01_April_25_to_31st_March_26, nvl(cr.CurStock,0) as Current_Stock, 0 as ANNUAL_INDENT_26_27, 
             nvl(vr.singlerate,0) as Rate, Formate.categoryname 
      from (
          select 0 SlNo, m.itemcode, m.ItemID, case when length(m.itemname)>100 then substr(m.itemname,0,100) else itemname end itemname, 
                 t.itemtypename Formulation, case when length(m.strength1)>100 then substr(m.strength1,0,100) else m.strength1 end Strength, 
                 g.groupname GroupName, e.edl, 0 COSUMPTION_From_1APR_24, 0 Current_Stock, 0 INDENT_25_26, m.isedl2021, mt.categoryname,
                 case when isedl2021='Y' then 'Yes' else 'No' end as EDL2021, case when EDL2025='Y' then 'Yes' else 'No' end as EDL2025,
                 case when (edl2025flag='COMMON' or edl2025flag='DHS') then 'Yes' else 'No' end as IsIPHS, mc.mcid
          from masitems m 
          inner join masitemai ai on ai.itemid=m.itemid and ai.ACCYRSETID=547
          inner join masitemgroups g on m.groupid=g.groupid  
          inner join masitemcategories mt on mt.categoryid=m.categoryid 
          inner join masitemmaincategory mc on mc.MCID=mt.MCID
          inner join masedl e on e.edlcat=m.edlcat 
          inner join masitemtypes t on t.itemtypeid=m.itemtypeid
          where mc.MCID in (1,2) and m.isfreez_itpr is null 
            and m.edlcat <= (select t.edlindent from masfacilities f inner join masfacilitytypes t on t.facilitytypeid=f.facilitytypeid where f.facilityid = :facId)
      ) Formate
      left outer join v_itemrate vr on vr.itemid=Formate.itemid
      left outer join (
          select ii.itemid, sum(tbo.issueqty) as FacIssueqty 
          from tbfacilityissues i
          inner join tbfacilityissueitems ii on ii.issueid=i.issueid
          inner join tbfacilityoutwards tbo on tbo.issueitemid=ii.issueitemid
          inner join tbfacilityreceiptbatches rb on rb.inwno=tbo.inwno
          where i.status='C' and i.facilityid = :facId
            and i.issuedate between to_date('01-APR-2025', 'DD-MON-YYYY') and to_date('31-MAR-2026', 'DD-MON-YYYY')
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
      order by DECODE(isedl2021, 'Y',1), 
               DECODE(categoryname, 'DRUGS',1, 'CONSUMABLE AND SURGICAL',2, 'SURGICALS AND SUTURES',3), groupname, itemname
    `;

    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ITEMCODE || r.itemCode || '-',
      itemName: r.ITEMNAME || r.itemName || '-',
      formulation: r.FORMULATION || r.formulation || '-',
      strength: r.STRENGTH || r.strength || '-',
      groupName: r.GROUPNAME || r.groupName || '-',
      edl: r.EDL || r.edl || '-',
      issuedFromWh: r.ISSUED_FROM_WH_01_APR_25_TO_31ST_OCT_25 || r.issued_From_WH_01_Apr_25_to_31st_Oct_25 || 0,
      actualConsumption: r.ACTUAL_CONSUMPTION_FROM_01_APRIL_25_TO_31ST_OCT_25 || 0,
      estimatedConsumption: r.ESTIMATED_CONSUMPTION_FOR_ONE_YEAR_FROM_01_APRIL_25_TO_31ST_MARCH_26 || 0,
      currentStock: r.CURRENT_STOCK || r.current_Stock || 0,
      annualIndent2627: r.ANNUAL_INDENT_26_27 || 0,
      rate: r.RATE || r.rate || 0,
      categoryName: r.CATEGORYNAME || r.categoryname || '-'
    }));
  } catch (error) {
    console.error('Error fetching Download AI Format Data:', error);
    throw error;
  }
}

// Get Financial Years for Upload & Forward Annual Indent
async function getUploadForwardFinYears() {
  try {
    const query = `select accyrsetid, accyear from masaccyearsettings where accyrsetid > 537 order by accyrsetid desc`;
    const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (result.rows || []).map(r => ({
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      accYear: r.ACCYEAR || r.accYear
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
             c.AccYear, a.facilityID 
      from masAnualIndent a
      inner join masaccyearsettings c on a.accyrsetid = c.accyrsetid
      where a.nonedlindenttype is null and a.isreagent is null 
        and a.AccYrSetID = :fyId
        and a.facilityID = :facId 
      Order by a.indentdate desc
    `;

    const result = await db.execute(query, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return rows.map((r, idx) => ({
      slNo: idx + 1,
      nocId: r.NOCID || r.nocId,
      nocNumber: r.NOCNUMBER || r.nocNumber || '-',
      nocDate: r.NOCDATE || r.nocDate || '-',
      status: r.STATUS || r.status || 'Completed',
      accYear: r.ACCYEAR || r.accYear || '-',
      facilityId: r.FACILITYID || r.facilityId,
      dispatchNo: r.DISPATCHNO || r.dispatchNo || '-',
      dispatchDate: r.DISPATCHDATE || r.dispatchDate || '-'
    }));
  } catch (error) {
    console.error('Error fetching Upload Forward Indent List:', error);
    throw error;
  }
}

// Fetch Header info for Create/Edit Annual Indent (AnualItemIndent.aspx)
async function getCreateIndentHeader(facilityId, finYearId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const query = `
      select indentid, indentno, to_char(indentdate,'dd-mm-yyyy') indentdate, status 
      from masAnualIndent 
      where nonedlindenttype is null and isreagent is null 
        and accyrsetid = :fyId and facilityid = :facId
    `;
    const result = await db.execute(query, { fyId, facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      const r = result.rows[0];
      return {
        indentId: r.INDENTID || r.indentId,
        indentNo: r.INDENTNO || r.indentNo,
        indentDate: r.INDENTDATE || r.indentDate,
        status: r.STATUS || r.status,
        exists: true
      };
    } else {
      return {
        indentId: 0,
        indentNo: 'AUTO GENERATED',
        indentDate: 'System Generated',
        status: 'N',
        exists: false
      };
    }
  } catch (error) {
    console.error('Error fetching Create Indent Header:', error);
    throw error;
  }
}

// Fetch Items Grid & Summary info for Create/Edit Annual Indent
async function getCreateIndentItems(facilityId, finYearId, indentId) {
  try {
    const facId = Number(facilityId) || 22595;
    const fyId = Number(finYearId) || 547;
    const indId = Number(indentId) || 0;

    const itemsQuery = `
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
      inner join masitemgroups g on g.groupid=m.groupid  
      inner join masitemcategories mt on mt.categoryid=m.categoryid 
      left outer Join masItemTypes b on (b.ItemTypeID = m.ItemTypeID)
      where ma.indentid = :indId 
        and ma.nonedlindenttype is null 
        and ma.isreagent is null 
        and ma.facilityid = :facId 
        and ma.accyrsetid = :fyId
      order by m.itemname
    `;

    const itemsRes = await db.execute(itemsQuery, { indId, facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
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
             round(sum(nvl(ai.FACILITYINDENTQTY,0)*nvl(ai.Rate,0))/10000000, 2) as indVal
      from masanualindent a 
      inner join anualindent ai on ai.indentid=a.indentid
      where a.indentid = :indId and nvl(ai.FACILITYINDENTQTY,0) > 0
      group by a.indentid
    `;
    const summaryRes = await db.execute(summaryQuery, { indId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let noOfItems = 0;
    let aproxIndentValue = '0.00';
    if (summaryRes.rows && summaryRes.rows.length > 0) {
      noOfItems = summaryRes.rows[0].CNTITE || summaryRes.rows[0].cntIte || 0;
      aproxIndentValue = String(summaryRes.rows[0].INDVAL || summaryRes.rows[0].indVal || '0.00');
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

module.exports = {
  getIndentItems,
  getIndentSummary,
  getFacilityDistributions,
  insertDistribution,
  updateDistribution,
  deleteDistribution,
  getMcHospitalAiVsIssuance,
  getDownloadAiFormatData,
  getUploadForwardFinYears,
  getUploadForwardList,
  getCreateIndentHeader,
  getCreateIndentItems,
  updateCreateIndentItem,
  deleteCreateIndentItem,
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport
};
