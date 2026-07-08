const db = require('./src/config/db');

async function testDelete() {
    await db.initialize();
    try {
        const res = await db.execute("SELECT IssueID, IssueNo FROM tbFacilityIssues WHERE IssueNo LIKE '%TR%00002%'");
        console.log("Found issues:", res.rows);
        
        if (res.rows.length > 0) {
            const issueIdNum = res.rows[0].ISSUEID || res.rows[0][0];
            const issueId = String(issueIdNum); // Pass as string
            console.log("Attempting to delete IssueID (as string):", issueId, typeof issueId);
            
            // Replicate delete logic
            const res1 = await db.execute("DELETE FROM tbFacilityOutwards WHERE IssueItemID IN (SELECT IssueItemID FROM tbFacilityIssueItems WHERE IssueID = :issueId)", { issueId }, { autoCommit: true });
            console.log("Rows affected (outwards):", res1.rowsAffected);
            
            const res2 = await db.execute("DELETE FROM tbFacilityIssueItems WHERE IssueID = :issueId", { issueId }, { autoCommit: true });
            console.log("Rows affected (items):", res2.rowsAffected);
            
            const res3 = await db.execute("Delete from tbFacilityIssues where IssueID = :issueId", { issueId }, { autoCommit: true });
            console.log("Rows affected (issues):", res3.rowsAffected);
            
            console.log("Deleted successfully in script");
        }
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}
testDelete();
