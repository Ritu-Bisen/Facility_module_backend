const db = require('./src/config/db');
require('dotenv').config();
const controller = require('./src/controllers/shcInterFacilityController');

async function run() {
  await db.initialize();
  const req = {};
  const res = {
    status: (c) => res,
    json: (d) => {
      console.log('Sample facility:', d.data[0]);
    }
  };
  await controller.getAllFacilities(req, res);
  await db.close();
}
run();
