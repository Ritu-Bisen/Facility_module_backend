const programIndentModel = require('../models/programIndentModel');

// Fetch programs
async function getPrograms(req, res, next) {
  try {
    const programs = await programIndentModel.getPrograms();
    return res.json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
}

// Fetch financial years
async function getFinYears(req, res, next) {
  try {
    const finYears = await programIndentModel.getFinYears();
    return res.json({ success: true, data: finYears });
  } catch (error) {
    next(error);
  }
}

// Fetch program indent list
async function getProgramIndentList(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.query.facilityId || 22595;
    const finYearId = req.query.finYearId;
    const list = await programIndentModel.getProgramIndentList(facilityId, finYearId);
    return res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
}

// Fetch single header
async function getProgramIndentHeader(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.query.facilityId || 22595;
    const finYearId = req.query.finYearId;
    const indentId = req.query.indentId || 0;
    const header = await programIndentModel.getProgramIndentHeader(facilityId, finYearId, indentId);
    return res.json({ success: true, data: header });
  } catch (error) {
    next(error);
  }
}

// Generate header
async function generateProgramIndentHeader(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 22595;
    const { finYearId, programId } = req.body;
    if (!programId) {
      return res.status(400).json({ success: false, message: 'Program selection is required' });
    }
    const header = await programIndentModel.generateProgramIndentHeader(facilityId, finYearId, programId);
    return res.json({ success: true, data: header, message: 'Program Indent Header generated successfully' });
  } catch (error) {
    next(error);
  }
}

// Update header
async function updateProgramIndentHeader(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 22595;
    const { indentId, programId, finYearId } = req.body;
    if (!indentId || !programId) {
      return res.status(400).json({ success: false, message: 'Indent ID and Program ID are required' });
    }
    await programIndentModel.updateProgramIndentHeader(facilityId, indentId, programId, finYearId);
    return res.json({ success: true, message: 'Program Indent Header updated successfully' });
  } catch (error) {
    next(error);
  }
}

// Delete header and items
async function deleteProgramIndent(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.query.facilityId || 22595;
    const indentId = req.params.indentId;
    if (!indentId) {
      return res.status(400).json({ success: false, message: 'Indent ID is required' });
    }
    await programIndentModel.deleteProgramIndent(facilityId, indentId);
    return res.json({ success: true, message: 'Program Indent deleted successfully' });
  } catch (error) {
    next(error);
  }
}

// Get items dropdown
async function getItemsDropdown(req, res, next) {
  try {
    const programId = req.query.programId;
    const items = await programIndentModel.getItemsDropdown(programId);
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

// Get indent items
async function getProgramIndentItems(req, res, next) {
  try {
    const indentId = req.query.indentId;
    if (!indentId) {
      return res.json({ success: true, data: [] });
    }
    const items = await programIndentModel.getProgramIndentItems(indentId);
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

// Save single item
async function saveProgramIndentItem(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 22595;
    const { finYearId, indentId, itemId, qty } = req.body;
    if (!indentId || !itemId || qty === undefined) {
      return res.status(400).json({ success: false, message: 'Indent ID, Item ID, and Quantity are required' });
    }
    await programIndentModel.saveProgramIndentItem(facilityId, finYearId, indentId, itemId, qty);
    return res.json({ success: true, message: 'Item saved successfully' });
  } catch (error) {
    next(error);
  }
}

// Save bulk items
async function saveBulkProgramIndentItems(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 22595;
    const { finYearId, indentId, items } = req.body;
    if (!indentId || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Indent ID and items array are required' });
    }
    await programIndentModel.saveBulkProgramIndentItems(facilityId, finYearId, indentId, items);
    return res.json({ success: true, message: 'Items saved successfully' });
  } catch (error) {
    next(error);
  }
}

// Delete item
async function deleteProgramIndentItem(req, res, next) {
  try {
    const anualIndentId = req.params.anualIndentId;
    if (!anualIndentId) {
      return res.status(400).json({ success: false, message: 'Annual Indent ID is required' });
    }
    await programIndentModel.deleteProgramIndentItem(anualIndentId);
    return res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    next(error);
  }
}

// Freeze indent
async function freezeProgramIndent(req, res, next) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 22595;
    const { indentId } = req.body;
    if (!indentId) {
      return res.status(400).json({ success: false, message: 'Indent ID is required' });
    }
    await programIndentModel.freezeProgramIndent(facilityId, indentId);
    return res.json({ success: true, message: 'Program Indent finalized/completed successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPrograms,
  getFinYears,
  getProgramIndentList,
  getProgramIndentHeader,
  generateProgramIndentHeader,
  updateProgramIndentHeader,
  deleteProgramIndent,
  getItemsDropdown,
  getProgramIndentItems,
  saveProgramIndentItem,
  saveBulkProgramIndentItems,
  deleteProgramIndentItem,
  freezeProgramIndent
};
