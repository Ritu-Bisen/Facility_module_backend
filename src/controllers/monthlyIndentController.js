const monthlyIndentModel = require('../models/monthlyIndentModel');

/**
 * GET /api/monthly-indent/list
 * List all NOC/Monthly Indent requests for the logged-in facility.
 * Query params: accYrSetId, status (All | Incomplete | Completed)
 */
async function getPrograms(req, res) {
  try {
    const list = await monthlyIndentModel.getPrograms();
    res.json(list);
  } catch (error) {
    console.error('getPrograms error:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
}

async function getItemCategories(req, res) {
  try {
    const categories = await monthlyIndentModel.getItemCategories();
    res.json(categories);
  } catch (error) {
    console.error('getItemCategories error:', error);
    res.status(500).json({ error: 'Failed to fetch item categories' });
  }
}

async function getItemTypes(req, res) {
  try {
    const types = await monthlyIndentModel.getItemTypes();
    res.json(types);
  } catch (error) {
    console.error('getItemTypes error:', error);
    res.status(500).json({ error: 'Failed to fetch item types' });
  }
}

async function getNocList(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { accYrSetId, status } = req.query;
    if (!accYrSetId) {
      return res.status(400).json({ error: 'accYrSetId is required' });
    }
    const list = await monthlyIndentModel.getNocList(facilityId, accYrSetId, status);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/monthly-indent/incomplete
 * Returns the current incomplete NOC for the facility (if any).
 */
async function getIncompleteNoc(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const noc = await monthlyIndentModel.getIncompleteNoc(facilityId);
    res.json(noc || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/monthly-indent/generate-no
 * Generates the next NOC number for the facility.
 */
async function generateNocNumber(req, res) {
  try {
    const facilityId = req.body.facilityId || req.user.facilityId;
    const nocNumber = await monthlyIndentModel.generateNocNumber(facilityId);
    res.json({ nocNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/monthly-indent/:nocId
 * Get a single NOC header by ID.
 */
async function getNocById(req, res) {
  try {
    const { nocId } = req.params;
    const noc = await monthlyIndentModel.getNocById(nocId);
    if (!noc) return res.status(404).json({ error: 'NOC not found' });
    res.json(noc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/monthly-indent/
 * Create a new NOC/Monthly Indent header.
 * Body: { accYrSetId, nocNumber, nocDate, programId }
 */
async function createNoc(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { accYrSetId, nocNumber, nocDate, programId } = req.body;
    if (!accYrSetId || !nocNumber || !nocDate || !programId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Block creation if an incomplete NOC already exists
    const existing = await monthlyIndentModel.getIncompleteNoc(facilityId);
    if (existing) {
      return res.status(409).json({
        error: 'An incomplete Monthly Indent already exists. Please delete it before creating a new one.',
        nocId: existing.NOCID,
        nocNumber: existing.NOCNUMBER
      });
    }

    const nocId = await monthlyIndentModel.createNocHeader({
      facilityId,
      accYrSetId,
      nocNumber,
      nocDate,
      programId
    });
    res.status(201).json({ message: 'Created successfully', nocId, nocNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/monthly-indent/:nocId
 * Update an existing NOC header (date, program, year).
 * Body: { nocDate, programId, accYrSetId }
 */
async function updateNoc(req, res) {
  try {
    const { nocId } = req.params;
    const { nocDate, programId, accYrSetId } = req.body;
    await monthlyIndentModel.updateNocHeader({ nocId, nocDate, programId, accYrSetId });
    res.json({ message: 'NOC updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/monthly-indent/:nocId/complete
 * Mark a NOC as Completed (status = 'C').
 */
async function completeNoc(req, res) {
  try {
    const { nocId } = req.params;
    await monthlyIndentModel.completeNoc(nocId);
    res.json({ message: 'Monthly Indent marked as Completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/monthly-indent/:nocId
 * Delete a NOC and all its items.
 */
async function deleteNoc(req, res) {
  try {
    const { nocId } = req.params;
    await monthlyIndentModel.deleteNoc(nocId);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/monthly-indent/:nocId/check
 * Check whether a completed NOC has indent/NOC quantities.
 */
async function checkNocIndent(req, res) {
  try {
    const { nocId } = req.params;
    const facilityId = req.user.facilityId;
    const result = await monthlyIndentModel.checkNocIndent(nocId, facilityId);
    res.json({
      hasIndent: result.INDENT > 0,
      hasNoc: result.NOC > 0,
      indentQty: result.INDENT,
      nocQty: result.NOC
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ─── NOC Items ─────────────────────────────────────────────────────────────

/**
 * GET /api/monthly-indent/:nocId/items
 * Get all items for a NOC.
 */
async function getNocItems(req, res) {
  try {
    const { nocId } = req.params;
    const items = await monthlyIndentModel.getNocItems(nocId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/monthly-indent/fm-items
 * Fetch items for FM-items and similar types for the facility.
 */
async function getFmItems(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { itemType, categoryId } = req.query;
    if (!itemType) {
      return res.status(400).json({ error: 'itemType query parameter is required' });
    }
    const items = await monthlyIndentModel.getFmItemsForFacility(facilityId, itemType, categoryId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/monthly-indent/:nocId/items
 * Add new items to a NOC (supports single item or array of items).
 */
async function saveNocItem(req, res) {
  try {
    const { nocId } = req.params;
    
    // Check if it's a bulk save
    if (req.body.items && Array.isArray(req.body.items)) {
      const results = [];
      const facilityId = req.user.facilityId;
      for (const item of req.body.items) {
        const nocItemId = await monthlyIndentModel.saveNocItem({
          nocId,
          facilityId,
          itemId: item.itemId,
          requestedqty: item.requestedqty,
          whStock: item.whStock,
          itemRemarks: item.itemRemarks,
          whStockQcPending: item.whStockQcPending,
          estimatedDate: item.estimatedDate,
          whId: item.whId,
          cgmsclRemarks: item.cgmsclRemarks,
          otherWhStock: item.otherWhStock,
          stockInHand: item.stockInHand,
          itemType: item.itemType,
          status: item.status,
          approvedQty: item.approvedQty,
          bookedQty: item.bookedQty,
          bookedFlag: item.bookedFlag,
          entry_date: item.entry_date,
          cmhoapplieddttime: item.cmhoapplieddttime
        });
        results.push(nocItemId);
      }
      return res.status(201).json({ message: 'Items saved successfully', nocItemIds: results });
    }

    // Single item save fallback
    const { 
      itemId, requestedqty, whStock, itemRemarks,
      whStockQcPending, estimatedDate, whId, cgmsclRemarks,
      otherWhStock, stockInHand, itemType, status,
      approvedQty, bookedQty, bookedFlag, entry_date, cmhoapplieddttime
    } = req.body;
    
    const facilityId = req.user.facilityId;
    
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }
    
    const nocItemId = await monthlyIndentModel.saveNocItem({
      nocId, facilityId, itemId, requestedqty, whStock, itemRemarks,
      whStockQcPending, estimatedDate, whId, cgmsclRemarks,
      otherWhStock, stockInHand, itemType, status,
      approvedQty, bookedQty, bookedFlag, entry_date, cmhoapplieddttime
    });
    res.status(201).json({ message: 'Item saved successfully', nocItemId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/monthly-indent/items/:nocItemId
 * Update an existing NOC item.
 * Body: { bookedQty, stockInHand, remarks }
 */
async function updateNocItem(req, res) {
  try {
    const { nocItemId } = req.params;
    const { requestedqty } = req.body;
    await monthlyIndentModel.updateNocItem({ nocItemId, requestedqty });
    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/monthly-indent/items/:nocItemId
 * Delete a single NOC item.
 */
async function deleteNocItem(req, res) {
  try {
    const { nocItemId } = req.params;
    await monthlyIndentModel.deleteNocItem(nocItemId);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

  /**
   * GET /api/monthly-indent/warehouse-items
   * Get warehouse stock items (Available or Stock Out) based on itemType.
   */
  async function getWarehouseItems(req, res) {
    try {
      const facilityId = req.user.facilityId;
      const { itemType } = req.query; // 'AVAILABLE' or 'STOCKOUT'
      if (!itemType) {
        return res.status(400).json({ error: 'itemType query parameter is required' });
      }
      const items = await monthlyIndentModel.getWarehouseItemsForFacility(facilityId, itemType);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/monthly-indent/dhs-indent-items
   * Fetch items for INDENT_DHS type.
   */
  async function getDhsIndentItems(req, res) {
    try {
      const facilityId = req.user.facilityId;
      const { categoryId } = req.query;
      const items = await monthlyIndentModel.getDhsIndentItemsForFacility(facilityId, categoryId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async function getAgainstApprovalIndentItems(req, res) {
    try {
      const facilityId = req.user.facilityId;
      const { categoryId } = req.query;
      const items = await monthlyIndentModel.getAgainstApprovalIndentItemsForFacility(facilityId, categoryId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/monthly-indent/other-item
   * Fetch details for a specific item code
   */
  async function getOtherItem(req, res) {
    try {
      const facilityId = req.user.facilityId;
      const { itemCode } = req.query;
      if (!itemCode) {
        return res.status(400).json({ error: 'itemCode query parameter is required' });
      }
      const items = await monthlyIndentModel.getOtherItemForFacility(facilityId, itemCode);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

module.exports = {
  getPrograms,
  getItemCategories,
  getItemTypes,
  getNocList,
  getIncompleteNoc,
  generateNocNumber,
  createNoc,
  updateNoc,
  deleteNoc,
  completeNoc,
  checkNocIndent,
  getNocById,
  getNocItems,
  saveNocItem,
  updateNocItem,
  deleteNocItem,
  getFmItems,
  getWarehouseItems,
  getDhsIndentItems,
  getAgainstApprovalIndentItems,
  getOtherItem,
};
