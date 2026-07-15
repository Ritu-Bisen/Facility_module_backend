const db = require('./src/config/db');
require('dotenv').config();
const controller = require('./src/controllers/inFacilityTransferController');

async function run() {
  await db.initialize();
  
  // Find an issue id
  const r = await db.execute("SELECT MAX(IssueID) as id FROM tbFacilityIssues WHERE ISSUETYPE='SH'");
  const maxId = r.rows[0].ID || r.rows[0].id || r.rows[0][0];
  console.log('Fetching issue', maxId);

  const req = { params: { id: maxId } };
  const res = {
    status: (c) => res,
    json: (d) => console.log(JSON.stringify(d, null, 2))
  };
  
  await controller.getIssueById(req, res);
  await db.close();
}
run();
