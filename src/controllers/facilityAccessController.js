const facilityAccessService = require('../services/facilityAccessService');

async function getNewModulesAndScreens(req, res, next) {
  try {
    const data = await facilityAccessService.getNewModulesAndScreens();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getPermissionsByFacility(req, res, next) {
  try {
    const { facilityType } = req.params;
    if (!facilityType) {
      return res.status(400).json({ success: false, message: 'Facility type is required' });
    }
    
    const data = await facilityAccessService.getPermissionsByFacility(facilityType);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching facility permissions: ' + err.message);
    next(err);
  }
}

async function getAllFacilityTypes(req, res, next) {
  try {
    const types = await facilityAccessService.getAllFacilityTypes();
    res.json({ success: true, data: types });
  } catch (err) {
    logger.error('Error fetching facility types: ' + err.message);
    next(err);
  }
}

async function saveFacilityPermissions(req, res, next) {
  try {
    const { facilityType, modules } = req.body;
    if (!facilityType || !modules) {
      return res.status(400).json({ success: false, message: 'Facility Type and modules are required' });
    }
    
    await facilityAccessService.saveFacilityPermissions(facilityType, modules);
    res.json({ success: true, message: 'Permissions saved successfully' });
  } catch (err) {
    next(err);
  }
}

async function getMyMenus(req, res, next) {
  try {
    // Admin override: show all menus to admink@gnail.com
    if (req.user.emailId && req.user.emailId.toLowerCase() === 'admink@gnail.com') {
      const allModulesTree = await facilityAccessService.getNewModulesAndScreens();
      // Set canView to true for every screen
      allModulesTree.forEach(module => {
        module.screens.forEach(screen => {
          screen.canView = true;
          screen.canAdd = true;
          screen.canEdit = true;
          screen.canDelete = true;
          screen.canApprove = true;
        });
      });
      
      return res.json({ success: true, menus: allModulesTree, facilityType: 'Admin' });
    }

    const facilityId = req.user.facilityId;
    let facilityType = 'PHC'; // Fallback default
    
    if (facilityId) {
      const db = require('../config/db');
      const sql = `
        SELECT ft.FACILITYTYPECODE
        FROM MASFACILITIES mf
        JOIN MASFACILITYTYPES ft ON mf.FACILITYTYPEID = ft.FACILITYTYPEID
        WHERE mf.FACILITYID = :facilityId
      `;
      const result = await db.execute(sql, [facilityId], { outFormat: 4002 });
      if (result.rows && result.rows.length > 0) {
        facilityType = result.rows[0].FACILITYTYPECODE;
      }
    }
    
    // Get permissions tree for this facility type
    const tree = await facilityAccessService.getPermissionsByFacility(facilityType);
    
    res.json({ success: true, menus: tree, facilityType });
  } catch (err) {
    next(err);
  }
}

// Ensure the table is created
async function initTable(req, res, next) {
  try {
    await facilityAccessService.init();
    res.json({ success: true, message: 'Facility Access Table Initialized' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNewModulesAndScreens,
  getPermissionsByFacility,
  saveFacilityPermissions,
  initTable,
  getMyMenus,
  getAllFacilityTypes
};
