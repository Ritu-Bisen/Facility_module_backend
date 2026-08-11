require('dotenv').config();
const db = require('./src/config/db');

async function run() {
  try {
    await db.initialize();
    await db.execute('ALTER TABLE USRUSERS ADD SESSION_ID VARCHAR2(100)');
    console.log('SESSION_ID column added.');
  } catch (err) {
    if (err.message.includes('ORA-01430')) {
      console.log('SESSION_ID column already exists.');
    } else {
      console.error(err);
    }
  } finally {
    try { await db.close(); } catch (e) {}
  }
}
run();
