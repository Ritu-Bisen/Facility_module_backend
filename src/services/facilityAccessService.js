const facilityAccessModel = require('../models/facilityAccessModel');

// Initialize table (can be called on server start or via dedicated endpoint for setup)
async function init() {
  await facilityAccessModel.initFacilityTable();
}

async function getNewModulesAndScreens() {
  const rows = await facilityAccessModel.getNewModulesAndScreens();
  return buildMenuTree(rows);
}

async function getAllFacilityTypes() {
  const rows = await facilityAccessModel.getAllFacilityTypes();
  return rows.map(r => r.FACILITYTYPECODE).filter(Boolean);
}

async function getPermissionsByFacility(facilityType) {
  const rows = await facilityAccessModel.getNewModulesAndScreens();
  const tree = buildMenuTree(rows);
  
  const permissions = await facilityAccessModel.getPermissionsByFacility(facilityType);
  
  // Map permissions to tree
  const pMap = {};
  (permissions || []).forEach(p => {
    const sid = p.SCREENID || p.ScreenID || p.screenid || p.ScreenId;
    const ops = p.OPERATIONS || p.Operations || p.operations || '';
    if (sid) {
      pMap[sid] = ops;
    }
  });
  
  // Apply permissions
  (tree || []).forEach(module => {
    (module.screens || []).forEach(screen => {
      const ops = pMap[screen.screenId] || '';
      screen.canView = ops.includes('V');
      screen.canAdd = ops.includes('A');
      screen.canEdit = ops.includes('E');
      screen.canDelete = ops.includes('D');
      screen.canApprove = ops.includes('P');
    });
  });
  
  return tree;
}

async function saveFacilityPermissions(facilityType, modules) {
  const permissionsToSave = [];
  
  (modules || []).forEach(module => {
    (module.screens || []).forEach(screen => {
      let ops = '';
      if (screen.canView) ops += 'V';
      if (screen.canAdd) ops += 'A';
      if (screen.canEdit) ops += 'E';
      if (screen.canDelete) ops += 'D';
      if (screen.canApprove) ops += 'P';
      
      if (ops.length > 0) {
        permissionsToSave.push({
          screenId: screen.screenId,
          operations: ops
        });
      }
    });
  });
  
  return await facilityAccessModel.saveFacilityPermissions(facilityType, permissionsToSave);
}

// Utility to build the nested tree
function buildMenuTree(rows) {
  const moduleMap = {};
  const modules = [];

  (rows || []).forEach(row => {
    const modId = row.MODULEID || row.ModuleID || row.moduleid || row.ModuleId;
    if (!modId) return;

    if (!moduleMap[modId]) {
      moduleMap[modId] = {
        moduleId: modId,
        moduleName: row.MODULENAME || row.ModuleName || row.modulename || '',
        moduleNo: row.MODULENO || row.ModuleNo || row.moduleno || 0,
        screens: []
      };
      modules.push(moduleMap[modId]);
    }
    
    const screenId = row.SCREENID || row.ScreenID || row.screenid || row.ScreenId;
    if (screenId) {
      moduleMap[modId].screens.push({
        screenId: screenId,
        screenName: row.SCREENNAME || row.ScreenName || row.screenname || '',
        screenUrl: row.SCREENURL || row.ScreenURL || row.screenurl || '',
        screenNo: row.SCREENNO || row.ScreenNo || row.screenno || 0,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
        canApprove: false
      });
    }
  });

  return modules;
}

module.exports = {
  init,
  getNewModulesAndScreens,
  getPermissionsByFacility,
  saveFacilityPermissions,
  getAllFacilityTypes
};
