const model = require('../models/shcInterFacilityModel');

const getTransfers = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const accYrSetId = req.query.accYrSetId;
        const status = req.query.status || 'All';

        if (!accYrSetId) {
            return res.status(400).json({ success: false, message: 'accYrSetId is required' });
        }

        const data = await model.getTransfers(facilityId, accYrSetId, status);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getTransfers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SHC transfers' });
    }
};

const getHeaderInfo = async (req, res) => {
    try {
        const { nocId } = req.params;
        const indentInfo = await model.getHeaderInfo(nocId);
        
        if (!indentInfo) {
            return res.status(404).json({ success: false, message: 'Indent not found' });
        }
        
        const issueHeader = await model.getIssueHeaderByNocId(nocId);
        
        let issueNo = 'AUTO GENERATED';
        let issueDate = new Date().toISOString().split('T')[0];
        let requestBy = '';
        
        if (issueHeader) {
            issueNo = issueHeader.IssueNo;
            issueDate = issueHeader.IssueDate;
            requestBy = issueHeader.WRequestBy || '';
        }
        
        res.json({ 
            success: true, 
            data: {
                indent: indentInfo,
                issueHeader: issueHeader ? {
                    issueId: issueHeader.IssueID,
                    issueNo: issueNo,
                    issueDate: issueDate,
                    requestBy: requestBy,
                    status: issueHeader.Status
                } : null
            }
        });
    } catch (error) {
        console.error('Error in getHeaderInfo:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch header info' });
    }
};

const generateDirectIssueNo = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { toFacilityId, issueDate, requestBy } = req.body;
        
        if (!toFacilityId || !issueDate) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const data = {
            facilityId,
            toFacilityId,
            issueDate,
            requestBy
        };

        const result = await model.generateDirectIssueNo(data);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('generateDirectIssueNo error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate direct issue number' });
    }
};

const saveIssueHeader = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { nocId } = req.params;
        let { issueNo, issueDate, requestBy, toFacilityId } = req.body;
        
        if (issueNo === 'AUTO GENERATED' || !issueNo) {
            issueNo = await model.generateIssueNo(facilityId);
        }
        
        const issueId = await model.saveIssueHeader({
            facilityId,
            issueNo,
            issueDate,
            toFacilityId,
            requestBy,
            facIndentId: nocId
        });
        
        res.json({ success: true, data: { issueId, issueNo } });
    } catch (error) {
        console.error('Error in saveIssueHeader:', error);
        res.status(500).json({ success: false, message: 'Failed to save header' });
    }
};

const getItems = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { nocId } = req.params;
        const { issueId } = req.query;
        
        const data = await model.getItemsForIndent(nocId, issueId, facilityId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getItems:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items' });
    }
};

const saveIssueItem = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { issueId } = req.params;
        const { issueItemId, itemId, curStock, allotted, issueQty } = req.body;
        
        const id = await model.saveIssueItem({
            facilityId,
            issueId,
            issueItemId,
            itemId,
            curStock,
            allotted,
            issueQty
        });
        
        res.json({ success: true, data: { issueItemId: id } });
    } catch (error) {
        console.error('Error in saveIssueItem:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to save item' });
    }
};

const deleteIssueItem = async (req, res) => {
    try {
        const { issueItemId } = req.params;
        await model.deleteIssueItem(issueItemId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in deleteIssueItem:', error);
        res.status(500).json({ success: false, message: 'Failed to delete item' });
    }
};

const completeIssue = async (req, res) => {
    try {
        const result = await model.completeIssue(req.params.issueId);
        res.json({ success: true, message: 'Issue completed successfully' });
    } catch (error) {
        console.error('completeIssue error:', error);
        res.status(500).json({ success: false, message: 'Failed to complete issue' });
    }
};

const deleteIssueHeader = async (req, res) => {
    try {
        await model.deleteIssueHeader(req.params.issueId);
        res.json({ success: true, message: 'Issue deleted successfully' });
    } catch (error) {
        console.error('deleteIssueHeader error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete issue' });
    }
};

const getAccYears = async (req, res) => {
    try {
        const data = await model.getAccYears();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getAccYears:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch financial years' });
    }
};

const getAllFacilities = async (req, res) => {
    try {
        const result = await model.getAllFacilities();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('getAllFacilities error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities' });
    }
};

module.exports = {
    getTransfers,
    getHeaderInfo,
    saveIssueHeader,
    generateDirectIssueNo,
    getItems,
    saveIssueItem,
    deleteIssueItem,
    completeIssue,
    deleteIssueHeader,
    getAllFacilities,
    getAccYears
};
