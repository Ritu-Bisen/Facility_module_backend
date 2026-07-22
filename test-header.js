require('dotenv').config();
const db = require('./src/config/db');
const model = require('./src/models/onlineTransferItemsModel');

async function run() {
    try {
        await db.initialize();
        const issueId = await model.createIssueHeader(12345, 67890, '2026-07-16', 'Test remarks', 9999);
        console.log("Success! Issue ID:", issueId);
    } catch (err) {
        console.error("Error creating issue header:", err);
    } finally {
        await db.close();
    }
}

run();
