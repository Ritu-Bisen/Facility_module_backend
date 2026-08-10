const db = require('../config/db');

async function getNocsForCancellation(facilityId) {
  const sql = `
    select facilityid as "facilityId", facilityname as "facilityName", nocid as "nocId", nocnumber as "nocNumber", 
           to_char(nocdate,'dd-MM-yyyy') as "nocDate", count(distinct itemid) as "cntNoItems", 
           count(distinct LPITEMID) as "cntLpItems", count(distinct cacelitemid) as "cntCancelItems",
           count(distinct itemid)-(count(distinct LPITEMID)+count(distinct cacelitemid)) as "cntBal"
    from (
      select m.itemcode, mn.nocid, mn.nocnumber, mn.nocdate, f.facilityname, mn.facilityid, mni.itemid, lp.LPITEMID, lp.pono, lp.podate,
             case when nvl(mni.Iscancel,'N')='Y' then mni.itemid end cacelitemid
      from mascgmscnoc mn
      inner join mascgmscnocitems mni on mni.nocid = mn.nocid
      inner join masfacilities f on f.facilityid = mn.facilityid
      inner join masfacilitytypes ft on ft.facilitytypeid = f.facilitytypeid
      inner join masitems m on m.itemid = mni.itemid
      left outer join (
        select lp.PSAID as Facilityid, lp.ponoid, lp.PONO, lp.PODATE, lpi.LPITEMID, NOCID, m.itemcode 
        from lpsoorderplaced lp 
        inner join lpsoordereditems lpi on lpi.ponoid = lp.ponoid
        inner join vmasitems mv on mv.itemid = lpi.LPITEMID
        inner join masitems m on m.itemcode = mv.EDLITEMCODE
        where lp.PSAID = :facilityId 
          and lp.ACCYRSETID = (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate) 
          and NOCID is not null
      ) lp on lp.Facilityid = mn.facilityid and mn.nocid = lp.NOCID and lp.itemcode = m.itemcode
      where mn.status = 'C' 
        and nvl(mni.approvedqty, 0) > 0  
        and mn.accyrsetid = (select accyrsetid from masaccyearsettings where sysdate between startdate and enddate) 
        and mn.facilityid = :facilityId
        and (
          (case when ft.hodid = 2 and mn.nocdate > '01-SEP-2024' then
             case when nvl(mni.IsCGMSCAPR,'NA') = 'Y' then 'Y' 
                  when nvl(mni.IsCGMSCAPR,'NA') = 'N' then 'N' 
                  when nvl(mni.IsCGMSCAPR,'NA') = 'NA' and sysdate > (nvl(CMHOAppliedDTTime, nocdate) + 48/24) then 'Y' 
                  else 'NA' 
             end
           else 'Y' 
          end) in ('N' ,'Y')
        )
    ) 
    group by nocid, nocnumber, nocdate, facilityid, facilityname
    having count(distinct itemid) - (count(distinct LPITEMID) + count(distinct cacelitemid)) > 0
  `;
  const result = await db.execute(sql, { facilityId: parseInt(facilityId, 10) }, { outFormat: 4002 });
  
  return result.rows.map(r => ({
    facilityId: r.facilityId || r.FACILITYID,
    facilityName: r.facilityName || r.FACILITYNAME,
    nocId: r.nocId || r.NOCID,
    nocNumber: r.nocNumber || r.NOCNUMBER,
    nocDate: r.nocDate || r.NOCDATE,
    cntNoItems: r.cntNoItems || r.CNTNOITEMS || 0,
    cntLpItems: r.cntLpItems || r.CNTLPITEMS || 0,
    cntCancelItems: r.cntCancelItems || r.CNTCANCELITEMS || 0,
    cntBal: r.cntBal || r.CNTBAL || 0
  }));
}

async function getNocItemsForCancellation(nocId) {
  const sql = `
    select m.itemcode as "itemCode", m.itemname as "itemName", m.strength1 as "strength", 
           mn.nocid as "nocId", mn.nocnumber as "nocNumber", to_char(mn.nocdate,'dd-MM-yyyy') as "nocDate",
           mni.approvedqty as "approvedQty", mni.SR as "sr", nvl(mni.IscancelStatus,'N') as "isCancelStatus",
           f.facilityname as "facilityName"
    from mascgmscnoc mn
    inner join mascgmscnocitems mni on mni.nocid = mn.nocid
    inner join masfacilities f on f.facilityid = mn.facilityid
    inner join masfacilitytypes ft on ft.facilitytypeid = f.facilitytypeid
    inner join masitems m on m.itemid = mni.itemid
    left outer join (
      select lp.PSAID as Facilityid, lp.ponoid, lp.PONO, lp.PODATE, lpi.LPITEMID, NOCID, m.itemcode 
      from lpsoorderplaced lp 
      inner join lpsoordereditems lpi on lpi.ponoid = lp.ponoid
      inner join vmasitems mv on mv.itemid = lpi.LPITEMID
      inner join masitems m on m.itemcode = mv.EDLITEMCODE
      where NOCID = :nocId 
        and NOCID is not null
    ) lp on lp.Facilityid = mn.facilityid and mn.nocid = lp.NOCID and lp.itemcode = m.itemcode
    where mn.status = 'C' 
      and nvl(mni.approvedqty, 0) > 0   
      and mn.nocid = :nocId
      and (
        (case when ft.hodid = 2 and mn.nocdate > '01-SEP-2024' then
           case when nvl(mni.IsCGMSCAPR,'NA') = 'Y' then 'Y' 
                when nvl(mni.IsCGMSCAPR,'NA') = 'N' then 'N' 
                when nvl(mni.IsCGMSCAPR,'NA') = 'NA' and sysdate > (nvl(CMHOAppliedDTTime, nocdate) + 48/24) then 'Y' 
                else 'NA' 
           end
         else 'Y' 
        end) in ('N' ,'Y')
      )
      and lp.LPITEMID is null 
      and mni.Iscancel is null
  `;
  const result = await db.execute(sql, { nocId: parseInt(nocId, 10) }, { outFormat: 4002 });
  
  return result.rows.map(r => ({
    itemCode: r.itemCode || r.ITEMCODE,
    itemName: r.itemName || r.ITEMNAME,
    strength: r.strength || r.STRENGTH,
    nocId: r.nocId || r.NOCID,
    nocNumber: r.nocNumber || r.NOCNUMBER,
    nocDate: r.nocDate || r.NOCDATE,
    approvedQty: r.approvedQty || r.APPROVEDQTY,
    sr: r.sr || r.SR,
    isCancelStatus: r.isCancelStatus || r.ISCANCELSTATUS,
    facilityName: r.facilityName || r.FACILITYNAME
  }));
}

async function cancelNocItems(srs, userId) {
  if (!srs || srs.length === 0) return;
  
  // Create comma separated list of SRs safely
  // Ensure they are numbers to prevent SQL injection
  const numericSrs = srs.map(sr => parseInt(sr, 10)).filter(sr => !isNaN(sr));
  
  if (numericSrs.length === 0) return;
  
  const srList = numericSrs.join(',');
  
  const sql = `
    update mascgmscnocitems 
    set Iscancel = 'Y', 
        cancelDate = sysdate, 
        cancelBy = :userId 
    where SR IN (${srList})
  `;
  
  await db.execute(sql, { userId: parseInt(userId, 10) }, { autoCommit: true });
}

module.exports = {
  getNocsForCancellation,
  getNocItemsForCancellation,
  cancelNocItems
};
