const db = require('../config/db');
const oracledb = require('oracledb');

async function getShcIndents(facilityId, accYrSetId, status) {
    let statusClause = '';
    const binds = { facilityId, accYrSetId };

    if (status && status !== 'All') {
        const statusMap = { Incomplete: 'I', Completed: 'C', Approved: 'A' };
        const dbStatus = statusMap[status] || status;
        statusClause = `AND i.Status = :status`;
        binds.status = dbStatus;
    }

    // We fetch indents where WAREHOUSEID is the logged-in facility
    // and the requesting facility is an SHC.
    const query = `
        SELECT 
            d.DistrictName as "district",
            f.FacilityName as "facility",
            i.RequestDocNo as "requestNo",
            TO_CHAR(i.RequestDate, 'DD-MM-YYYY') as "requestDate",
            CASE i.Status
                WHEN 'A' THEN 'Approved'
                WHEN 'I' THEN 'Incomplete'
                WHEN 'C' THEN 'Completed'
                ELSE 'Incomplete'
            END as "status",
            i.IndentID as "indentId"
        FROM tbIndents i
        INNER JOIN masFacilities f ON i.FacilityID = f.FacilityID
        LEFT JOIN masDistricts d ON f.DistrictID = d.DistrictID
        INNER JOIN masAccYearSettings y ON (i.RequestDate BETWEEN y.StartDate AND y.EndDate)
        WHERE (UPPER(f.FacilityName) LIKE '%SHC%' OR f.FacilityTypeID = 7)
          AND y.ACCYRSETID = :accYrSetId
          AND i.WarehouseID = :facilityId
          ${statusClause}
        ORDER BY i.RequestDate DESC
    `;

    try {
        const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
    } catch (err) {
        console.error("Error executing getShcIndents query.", err);
        throw err;
    }
}

module.exports = {
    getShcIndents
};
