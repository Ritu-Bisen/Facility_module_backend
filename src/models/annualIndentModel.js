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

module.exports = {
  getIndentItems,
  getIndentSummary,
  getFacilityDistributions,
  insertDistribution,
  updateDistribution,
  deleteDistribution
};
