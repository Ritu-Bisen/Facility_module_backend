const db = require('./src/config/db');
const issueService = require('./src/services/issueService');

async function test() {
  await db.initialize();
  try {
    const data = {
      facilityId: 23246,
      toFacilityId: 23246, // Just a test
      issueDate: '2026-07-03',
      issueType: 'TR',
      requestBy: 1
    };
    const issueNo = await issueService.generateAndSaveIssue(data);
    console.log("Successfully generated and saved:", issueNo);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.close();
  }
}

test();
