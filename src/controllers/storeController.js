const storeModel = require('../models/storeModel');

async function getCurrentStockDrugWise(req, res) {
    try {
        const { facilityId, itemId, stockStatus } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const data = await storeModel.getCurrentStockDrugWise(facilityId, itemId, stockStatus || 'all');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getFacilityStockItemWise(req, res) {
    try {
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const data = await storeModel.getFacilityStockItemWise(facilityId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getCurrentStockBatchWise(req, res) {
    try {
        const { facilityId, itemTypeId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        
        const data = await storeModel.getCurrentStockBatchWise(facilityId, itemTypeId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getFacilityStockDrugWise(req, res) {
    try {
        const facilityId = req.query.facilityId || (req.user && req.user.facilityId);
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const data = await storeModel.getFacilityStockDrugWise(facilityId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getWarehouseStock(req, res) {
    try {
        const facilityId = req.query.facilityId || (req.user && req.user.facilityId);
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const data = await storeModel.getWarehouseStock(facilityId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getCurrentStockDrugWise,
    getFacilityStockItemWise,
    getCurrentStockBatchWise,
    getFacilityStockDrugWise,
    getWarehouseStock
};
