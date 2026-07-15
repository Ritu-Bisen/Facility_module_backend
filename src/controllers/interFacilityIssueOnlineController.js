const model = require('../models/interFacilityIssueOnlineModel');

exports.getIndentsForIssue = async (req, res) => {
    try {
        const facilityId = req.user.facilityId; // This acts as the fromFacilityId
        const { yearId, status } = req.query;

        if (!yearId) {
            return res.status(400).json({ success: false, message: 'Year ID is required' });
        }

        const indents = await model.getIndentsForIssue(facilityId, yearId, status);
        res.json({ success: true, data: indents });
    } catch (error) {
        console.error('Error in getIndentsForIssue:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch indents for issue' });
    }
};

exports.getIssuesForIndent = async (req, res) => {
    try {
        const { indentId } = req.params;
        const issues = await model.getIssuesForIndent(indentId);
        res.json({ success: true, data: issues });
    } catch (error) {
        console.error('Error in getIssuesForIndent:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch issues for indent' });
    }
};
