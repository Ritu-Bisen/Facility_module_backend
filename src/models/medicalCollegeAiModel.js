const db = require('../config/db');
const oracledb = require('oracledb');

// Fetch MC Hospital AI vs Issuance (NOC and Balance status)
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
            inner join tbfacilityreceiptbatches tb on tb.inwno = ftbo.inwno
            where fs.facilityid = :facId and fs.status = 'C'
            group by fs.facilityid, fsi.itemid, ftbo.inwno
          ) iq on iq.inwno = b.inwno and iq.facilityid = t.facilityid
          where (b.expdate >= sysdate or b.expdate is null)
            and t.status = 'C' and t.facilityid = :facId
        )
        group by itemid
      ) facstock on facstock.itemid = a.itemid
      left outer join 
      (
        select sum(tbo.issueqty) IssuedQTYNos, f.facilityid, tbi.itemid
        from tbindents tb
        inner join tbindentitems tbi on tbi.indentid = tb.indentid 
        inner join tboutwards tbo on tbo.indentitemid = tbi.indentitemid
        inner join tbreceiptbatches rb on rb.inwno = tbo.inwno
        inner join masfacilities f on f.facilityid = tb.facilityid 
        inner join masaccyearsettings yr on yr.accyrsetid = 547
        where tb.Status = 'C' and tb.issuetype = 'NO'
          and tb.indentdate between yr.startdate and yr.enddate
          and f.facilityid = :facId
        group by f.facilityid, tbi.itemid
      ) iss on iss.itemid = a.itemid and iss.facilityid = a.facilityid
      inner join mv_masitems m on m.itemid = a.itemid
      order by m.ITEMCODE
    `;

    const result = await db.execute(query, { facId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    return rows.map((r, idx) => ({
      sNo: idx + 1,
      nocPermission: r.NOCPERMISSION || r.nocPermission || 'N',
      itemId: r.ITEMID || r.itemId,
      facilityName: r.FACILITYNAME || r.facilityName || '',
      facAiNos: r.FACAI_NOS || r.facAi_Nos || 0,
      aiDistNos: r.AIDIST_NOS || r.aiDist_Nos || 0,
      facStock: r.FACSTOCK || r.facStock || 0,
      whIssuedCfy: r.WHISSUEDCFY || r.whIssuedCfy || 0,
      balanceAiQtyNos: r.BALANCEAIQTYNOS || r.balanceAiQtyNos || 0,
      readyWhSku: r.READYWHSKU || r.readyWhSku || 0,
      readyWhNos: r.READYWHNOS || r.readyWhNos || 0,
      uqcNos: r.UQCNOS || r.uqcNos || 0,
      uqcSku: r.UQCSKU || r.uqcSku || 0,
      receiptDateAtWarehouse: r.RECEIPTDATEATWAREHOUSE || r.receiptDateAtWarehouse || '',
      qcPassedDate: r.QCPASSEDDATE || r.qcPassedDate || '',
      facilityId: r.FACILITYID || r.facilityId,
      hodId: r.HODID || r.hodId,
      accYrSetId: r.ACCYRSETID || r.accYrSetId,
      facilityTypeId: r.FACILITYTYPEID || r.facilityTypeId,
      statusYear: r.STATUSYEAR || r.statusYear || 'N',
      unitCount: r.UNITCOUNT || r.unitCount || 1,
      warehouseId: r.WAREHOUSEID || r.warehouseId,
      itemName: r.ITEMNAME || r.itemName || '',
      itemCode: r.ITEMCODE || r.itemCode || '',
      strength: r.STRENGTH || r.strength || '',
      unit: r.UNIT || r.unit || '',
      mCategory: r.MCATEGORY || r.mCategory || '',
      itemTypeName: r.ITEMTYPENAME || r.itemTypeName || '',
      groupName: r.GROUPNAME || r.groupName || ''
    }));
  } catch (error) {
    console.error('Error fetching MC Hospital AI vs Issuance:', error);
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
  getMcHospitalAiVsIssuance,
  getMedicalCollegeAiDropdowns,
  getMedicalCollegeAiReport,
  getMcAiVsIssuanceDropdowns,
  getMcAiVsIssuanceReport
};
