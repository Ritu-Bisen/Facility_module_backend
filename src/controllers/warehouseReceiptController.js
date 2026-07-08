const warehouseReceiptModel = require('../models/warehouseReceiptModel');

async function getWarehouseIndents(req, res) {
    try {
        const { facilityId } = req.user; // Assuming authMiddleware puts user object on req
        const accYear = req.query.accYear;
        
        if (!accYear) {
            return res.status(400).json({ success: false, message: 'Financial year is required' });
        }

        const data = await warehouseReceiptModel.getWarehouseIndents(facilityId, accYear);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getWarehouseIndents:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch warehouse indents' });
    }
}

async function getReceiptsByIndent(req, res) {
    try {
        const { facilityId } = req.user;
        const indentId = req.params.indentId;

        if (!indentId) {
            return res.status(400).json({ success: false, message: 'Indent ID is required' });
        }

        const data = await warehouseReceiptModel.getReceiptsByIndent(facilityId, indentId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getReceiptsByIndent:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipts' });
    }
}

async function getFinancialYears(req, res) {
    try {
        const data = await warehouseReceiptModel.getFinancialYears();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getFinancialYears:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch financial years' });
    }
}

async function getReceiptDetails(req, res) {
    try {
        const { facilityId } = req.user;
        const receiptId = req.params.receiptId;

        if (!receiptId) {
            return res.status(400).json({ success: false, message: 'Receipt ID is required' });
        }

        const header = await warehouseReceiptModel.getReceiptHeader(facilityId, receiptId);
        
        if (!header) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        const items = await warehouseReceiptModel.getReceiptItems(facilityId, receiptId);
        
        // Fetch batches for each item
        const itemsWithBatches = await Promise.all(items.map(async (item) => {
            const batches = await warehouseReceiptModel.getReceiptBatches(item.indentItemId);
            return {
                ...item,
                batches
            };
        }));

        res.json({
            success: true,
            data: {
                header,
                items: itemsWithBatches
            }
        });
    } catch (error) {
        console.error('Error in getReceiptDetails:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipt details' });
    }
}

async function getStockLocations(req, res) {
    try {
        const { facilityId } = req.user;
        const data = await warehouseReceiptModel.getStockLocations(facilityId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getStockLocations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stock locations' });
    }
}

async function saveReceiptItem(req, res) {
    try {
        const { facilityId } = req.user;
        const { receiptId } = req.params;
        const payload = req.body;
        
        await warehouseReceiptModel.saveReceiptItem(facilityId, receiptId, payload);
        res.json({ success: true, message: 'Item saved successfully' });
    } catch (error) {
        console.error('Error in saveReceiptItem:', error);
        res.status(500).json({ success: false, message: 'Failed to save receipt item' });
    }
}

async function getReceiptBatches(req, res) {
    try {
        const { indentItemId } = req.params;
        const data = await warehouseReceiptModel.getReceiptBatches(indentItemId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in getReceiptBatches:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipt batches' });
    }
}

async function addBatch(req, res) {
    try {
        const { facilityId } = req.user;
        const { receiptId } = req.params;
        const payload = req.body;

        // ── Input validation (mirrors ASP.NET required fields) ──────────────
        const { batchNo, mfgDate, expDate, absRQty, stockLocation, itemId, indentItemId } = payload;

        if (!batchNo || batchNo.trim() === '') {
            return res.status(400).json({ success: false, message: 'Batch Number is required.' });
        }
        if (!mfgDate) {
            return res.status(400).json({ success: false, message: 'Manufacturing Date is required.' });
        }
        if (!expDate) {
            return res.status(400).json({ success: false, message: 'Expiry Date is required.' });
        }
        if (absRQty === undefined || absRQty === null || absRQty === '' || Number(absRQty) <= 0) {
            return res.status(400).json({ success: false, message: 'Received Quantity must be greater than 0.' });
        }
        if (!stockLocation) {
            return res.status(400).json({ success: false, message: 'Stock Location (Rack) must be selected.' });
        }
        if (!itemId || !indentItemId) {
            return res.status(400).json({ success: false, message: 'Item ID and Indent Item ID are required.' });
        }
        if (!receiptId) {
            return res.status(400).json({ success: false, message: 'Receipt ID is required.' });
        }

        const result = await warehouseReceiptModel.addBatch(facilityId, receiptId, {
            ...payload,
            absRQty: Number(absRQty)
        });

        res.json(result);
    } catch (error) {
        console.error('Error in addBatch controller:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to save batch.'
        });
    }
}

async function completeReceipt(req, res) {
    try {
        const facilityId = req.user?.facilityId ; // Fallback for dev
        const receiptId = req.params.receiptId;
        
        if (!receiptId) {
            return res.status(400).json({ success: false, message: 'Receipt ID is required.' });
        }

        const result = await warehouseReceiptModel.completeFacilityReceipt(receiptId, facilityId);
        res.json(result);
    } catch (error) {
        console.error('Error completing receipt:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to complete receipt.'
        });
    }
}

module.exports = {
    getWarehouseIndents,
    getReceiptsByIndent,
    getFinancialYears,
    getReceiptDetails,
    getStockLocations,
    saveReceiptItem,
    getReceiptBatches,
    addBatch,
    completeReceipt
};
