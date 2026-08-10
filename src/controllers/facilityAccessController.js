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
    const userId = req.user.userId;
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
    
    // Get role-based permissions for this user
    const userService = require('../services/userService');
    const roleMenus = await userService.getUserMenus(userId);
    
    // Map role screens for fast lookup
    const roleScreenMap = {};
    roleMenus.forEach(mod => {
      mod.screens.forEach(s => {
        roleScreenMap[s.SCREENID || s.screenid] = true;
      });
    });

    // Check if USRFACILITYSCREENS actually has ANY rules for this facilityType
    let hasFacilityPermissions = false;
    tree.forEach(module => {
      module.screens.forEach(screen => {
        if (screen.canView) hasFacilityPermissions = true;
      });
    });

    // If NO facility permissions exist (unconfigured), fallback to ONLY Role permissions
    tree.forEach(module => {
      module.screens.forEach(screen => {
        if (!hasFacilityPermissions) {
           // Fallback to Role only
           if (roleScreenMap[screen.screenId]) {
               screen.canView = true;
               screen.canAdd = true;
               screen.canEdit = true;
               screen.canDelete = true;
               screen.canApprove = true;
           }
        }
        // If hasFacilityPermissions is true, we simply keep the permissions from USRFACILITYSCREENS
        // and do not intersect with roleScreenMap, so it strictly follows facility type.
      });
    });
    
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
