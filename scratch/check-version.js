const db = require('../src/config/db');
async function run() {
  try {
    await db.initialize();
    const result = await db.execute("SELECT * FROM v$version", {});
    console.log(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
run();
