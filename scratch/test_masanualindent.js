const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/config/db');
const oracledb = require('oracledb');

async function testMasAnualIndent() {
  try {
    console.log('Testing masAnualIndent table insert...');
    await db.initialize();
    
    const facId = 23558;
    const fyId = 547;
    const progId = 16;
    const shYear = '26-27';

    const seqQuery = `
      select nvl(max(auto_aicode), 0) + 1 as nextcode 
      from masAnualIndent 
      where facilityid = :facId 
        and accyrsetid = :fyId 
        and aicategoryid is not null
    `;
    const seqRes = await db.execute(seqQuery, { facId, fyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const nextCode = seqRes.rows && seqRes.rows[0] ? (seqRes.rows[0].NEXTCODE || seqRes.rows[0].nextcode || 1) : 1;
    const codeStr = String(nextCode).padStart(5, '0');
    const indentNo = `${facId}/PI${codeStr}/${shYear}`;

    console.log('Generated Indent No:', indentNo);

    const idQuery = `select nvl(max(indentid), 0) + 1 as nextid from masAnualIndent`;
    const idRes = await db.execute(idQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const indentId = idRes.rows && idRes.rows[0] ? (idRes.rows[0].NEXTID || idRes.rows[0].nextid || 1) : 1;

    console.log('Next Indent ID:', indentId);

    const insertQuery = `
      insert into masAnualIndent (indentid, AccYrSetID, FacilityID, indentno, indentdate, Status, auto_aicode, aicategoryid, entrydate)
      values (:indentId, :fyId, :facId, :indentNo, sysdate, 'I', :nextCode, :progId, sysdate)
    `;
    const insertRes = await db.execute(insertQuery, { indentId, fyId, facId, indentNo, nextCode, progId }, { autoCommit: true });
    console.log('Insert success! Rows affected:', insertRes.rowsAffected);

    // Rollback / clean up test record
    await db.execute(`delete from masAnualIndent where indentid = :indentId`, { indentId }, { autoCommit: true });
    console.log('Test record cleaned up successfully.');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.exit(0);
  }
}

testMasAnualIndent();
