require('dotenv').config();
const db = require('./src/config/db');
const model = require('./src/models/onlineTransferItemsModel');

async function check() {
    try {
        await db.initialize();
        
        const oracledb = require('oracledb');
        const indentQuery = `SELECT indentid, facilityid FROM MASFACTRANSFERS WHERE ROWNUM <= 1`;
        const indentResult = await db.execute(indentQuery, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }); 
        if (indentResult.rows.length === 0) {
            console.log("No indents found");
            return;
        }
        
        const nocId = indentResult.rows[0].INDENTID;
        const toFacilityId = indentResult.rows[0].FACILITYID; // Usually requested by some facility
        
        // We will just test getItemsForIssue for facilityId=22773 and this nocId
        console.log(`Testing getItemsForIssue with nocId=${nocId}, facilityId=22773`);
        const items = await model.getItemsForIssue(nocId, 0, 22773);
        console.log("Items:", items);

    } catch (err) {
        console.error(err);
    } finally {
        await db.close();
    }
}
check();
