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
  permissions.forEach(p => {
    pMap[p.SCREENID] = p.OPERATIONS || '';
  });
  
  // Apply permissions
  tree.forEach(module => {
    module.screens.forEach(screen => {
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
  
  modules.forEach(module => {
    module.screens.forEach(screen => {
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

  rows.forEach(row => {
    const modId = row.MODULEID;
    if (!moduleMap[modId]) {
      moduleMap[modId] = {
        moduleId: modId,
        moduleName: row.MODULENAME,
        moduleNo: row.MODULENO,
        screens: []
      };
      modules.push(moduleMap[modId]);
    }
    
    if (row.SCREENID) {
      moduleMap[modId].screens.push({
        screenId: row.SCREENID,
        screenName: row.SCREENNAME,
        screenUrl: row.SCREENURL,
        screenNo: row.SCREENNO,
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
