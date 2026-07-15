const db = require('./src/config/db');
require('dotenv').config();
const controller = require('./src/controllers/shcInterFacilityController');

async function run() {
  await db.initialize();
  const req = {};
  const res = {
    status: (c) => res,
    json: (d) => {
      const data = d.data || [];
      const found = data.find(f => f.facilityId === 27952 || f.facilityId === '27952');
      console.log('Found:', found);
    }
  };
  await controller.getAllFacilities(req, res);
  await db.close();
}
run();
