const db = require('./src/config/db');
const oracledb = require('oracledb');

async function test() {
    try {
        await db.initialize();
        
        const q1 = "SELECT sequence_name FROM all_sequences WHERE sequence_name LIKE '%FACILITY%'";
        const r1 = await db.execute(q1, {}, {outFormat: oracledb.OUT_FORMAT_OBJECT});
        console.log('Sequences:', r1.rows);

        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
