const issueService = require('../services/issueService');
const logger = require('../utils/logger'); // assuming logger exists

async function generateIssueNumber(req, res) {
    try {
        const facilityId = parseInt(req.params.facilityId, 10);
        const { type } = req.query;

        if (isNaN(facilityId)) {
            return res.status(400).json({ success: false, message: 'Invalid facilityId provided' });
        }

        const issueNo = await issueService.generateIssueNumber(facilityId, type || 'TR');

        if (!issueNo) {
            return res.status(404).json({ success: false, message: 'Facility not found' });
        }

        return res.status(200).json({
            success: true,
            issueNo
        });

    } catch (error) {
        if (logger && logger.error) {
            logger.error('Error generating issue number: ' + error.message);
        } else {
            console.error('Error generating issue number:', error);
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function generateAndSaveIssue(req, res) {
    try {
        const facilityId = parseInt(req.params.facilityId, 10);
        const { toFacilityId, issueDate, issueType, requestBy, remarks, category, issueEdl } = req.body;

        if (isNaN(facilityId)) {
            return res.status(400).json({ success: false, message: 'Invalid facilityId provided' });
        }
        
        if (!toFacilityId || !issueDate) {
            return res.status(400).json({ success: false, message: 'Missing required fields: toFacilityId, issueDate' });
        }

        const edlVal = issueEdl ? Number(issueEdl) : (category === 'EDL of higher category' ? 2 : 1);

        const data = {
            facilityId,
            toFacilityId,
            issueDate,
            issueType,
            requestBy,
            remarks,
            issueEdl: edlVal
        };

        const { issueNo, issueId } = await issueService.generateAndSaveIssue(data);

        return res.status(200).json({
            success: true,
            issueNo,
            issueId
        });
    } catch (error) {
        if (logger && logger.error) {
            logger.error('Error generating and saving issue: ' + error.message);
        } else {
            console.error('Error generating and saving issue:', error);
        }
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
}

module.exports = {
    generateIssueNumber,
    generateAndSaveIssue
};
