const model = require('../models/onlineTransferItemsModel');

exports.getIndentHeader = async (req, res) => {
    try {
        const nocId = req.params.nocId;
        const data = await model.getIndentHeader(nocId);
        if (data.length > 0) {
            res.json({ success: true, data: data[0] });
        } else {
            res.json({ success: false, message: 'Indent not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getIssueHeader = async (req, res) => {
    try {
        const issueId = req.params.issueId;
        const data = await model.getIssueHeader(issueId);
        if (data.length > 0) {
            res.json({ success: true, data: data[0] });
        } else {
            res.json({ success: false, message: 'Issue not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createIssueHeader = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { toFacilityId, issueDate, remarks, facIndentId } = req.body;
        const issueId = await model.createIssueHeader(facilityId, toFacilityId, issueDate, remarks, facIndentId);
        res.json({ success: true, issueId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create issue header' });
    }
};

exports.updateIssueHeader = async (req, res) => {
    try {
        const issueId = req.params.issueId;
        const { issueDate, remarks } = req.body;
        await model.updateIssueHeader(issueId, issueDate, remarks);
        res.json({ success: true, message: 'Issue updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update issue header' });
    }
};

exports.getItemsForIssue = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { issueId, nocId } = req.params;
        const data = await model.getItemsForIssue(nocId, issueId === '0' ? null : issueId, facilityId);
        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
