const db = require('./src/config/db');

async function run() {
  await db.initialize();
  try {
    await db.execute(`ALTER TABLE USRUSERS ADD FAILED_ATTEMPTS NUMBER DEFAULT 0`);
    console.log('Added FAILED_ATTEMPTS column');
  } catch (err) {
    if (err.message.includes('ORA-01430')) {
      console.log('FAILED_ATTEMPTS column already exists');
    } else {
      throw err;
    }
  }

  try {
    await db.execute(`ALTER TABLE USRUSERS ADD LOCKOUT_UNTIL DATE`);
    console.log('Added LOCKOUT_UNTIL column');
  } catch (err) {
    if (err.message.includes('ORA-01430')) {
      console.log('LOCKOUT_UNTIL column already exists');
    } else {
      throw err;
    }
  }
  
  await db.close();
}

run().catch(console.error);
