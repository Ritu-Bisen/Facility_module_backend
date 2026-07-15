const model = require('../models/indentToOtherFacilityModel');

exports.getIndents = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { yearId, status } = req.query;
        if (!yearId) return res.status(400).json({ success: false, message: 'Year ID is required' });
        const indents = await model.getIndents(facilityId, yearId, status);
        res.json({ success: true, data: indents });
    } catch (error) {
        console.error('Error in getIndents:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch indents' });
    }
};

exports.createIndent = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { fromFacilityId, yearId, indentDate } = req.body;
        if (!fromFacilityId || !yearId) {
            return res.status(400).json({ success: false, message: 'From Facility and Year ID are required' });
        }
        const result = await model.createIndent(facilityId, fromFacilityId, yearId, indentDate);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in createIndent:', error);
        res.status(500).json({ success: false, message: 'Failed to create indent' });
    }
};

// GET /api/indent-to-other-facility/:indentId
exports.getIndentDetail = async (req, res) => {
    try {
        const { indentId } = req.params;
        const result = await model.getIndentDetail(Number(indentId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in getIndentDetail:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch indent detail' });
    }
};

// GET /api/indent-to-other-facility/items?facilityId=xxx
exports.getItemsForFacility = async (req, res) => {
    try {
        const { facilityId } = req.query;
        if (!facilityId) return res.status(400).json({ success: false, message: 'facilityId is required' });
        const items = await model.getItemsForFacility(facilityId);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error in getItemsForFacility:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items' });
    }
};

// POST /api/indent-to-other-facility/:indentId/items
exports.saveIndentItem = async (req, res) => {
    try {
        const { indentId } = req.params;
        const { itemId, requestedQty, approvedQty, facStock, stockInHand, status } = req.body;
        if (!itemId || !requestedQty) {
            return res.status(400).json({ success: false, message: 'itemId and requestedQty are required' });
        }
        await model.saveIndentItem(
            Number(indentId), 
            Number(itemId), 
            Number(requestedQty), 
            Number(approvedQty || requestedQty), 
            Number(facStock || 0),
            Number(stockInHand || 0),
            status || 'I'
        );
        res.json({ success: true, message: 'Item saved successfully' });
    } catch (error) {
        console.error('Error in saveIndentItem:', error);
        res.status(500).json({ success: false, message: 'Failed to save item' });
    }
};

// PUT /api/indent-to-other-facility/:indentId/items/:itemId
exports.editIndentItem = async (req, res) => {
    try {
        const { indentId, itemId } = req.params;
        const { requestedQty, approvedQty } = req.body;
        if (!requestedQty) {
            return res.status(400).json({ success: false, message: 'requestedQty is required' });
        }
        await model.editIndentItem(
            Number(indentId), 
            Number(itemId), 
            Number(requestedQty), 
            Number(approvedQty || requestedQty)
        );
        res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
        console.error('Error in editIndentItem:', error);
        res.status(500).json({ success: false, message: 'Failed to update item' });
    }
};

// DELETE /api/indent-to-other-facility/:indentId/items/:itemId
exports.deleteIndentItem = async (req, res) => {
    try {
        const { indentId, itemId } = req.params;
        await model.deleteIndentItem(Number(indentId), Number(itemId));
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error in deleteIndentItem:', error);
        res.status(500).json({ success: false, message: 'Failed to delete item' });
    }
};

// PUT /api/indent-to-other-facility/:indentId
exports.updateIndent = async (req, res) => {
    try {
        const { indentId } = req.params;
        const { fromFacilityId, accYrSetId } = req.body;
        await model.updateIndent(Number(indentId), Number(fromFacilityId), Number(accYrSetId));
        res.json({ success: true, message: 'Indent updated successfully' });
    } catch (error) {
        console.error('Error in updateIndent:', error);
        res.status(500).json({ success: false, message: 'Failed to update indent' });
    }
};

// DELETE /api/indent-to-other-facility/:indentId
exports.deleteIndent = async (req, res) => {
    try {
        const { indentId } = req.params;
        await model.deleteIndent(Number(indentId));
        res.json({ success: true, message: 'Indent deleted successfully' });
    } catch (error) {
        console.error('Error in deleteIndent:', error);
        res.status(500).json({ success: false, message: 'Failed to delete indent' });
    }
};

// POST /api/indent-to-other-facility/:indentId/complete
exports.completeIndent = async (req, res) => {
    try {
        const { indentId } = req.params;
        await model.completeIndent(Number(indentId));
        res.json({ success: true, message: 'Indent completed successfully' });
    } catch (error) {
        console.error('Error in completeIndent:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to complete indent' });
    }
};
