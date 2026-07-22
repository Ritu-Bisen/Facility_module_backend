const roleModel = require('../models/roleModel');

async function getRoles() {
  return await roleModel.getRoles();
}

async function getRolePermissionsData(roleId) {
  // 1. Get all modules and screens
  const rawScreens = await roleModel.getAllModulesAndScreens();
  
  // 2. Get role's existing permissions
  const rolePermissions = await roleModel.getRolePermissions(roleId);
  const permissionsMap = {};
  rolePermissions.forEach(p => {
    permissionsMap[p.SCREENID] = p.OPERATIONS || '';
  });

  // 3. Group by Module
  const modulesMap = {};
  rawScreens.forEach(row => {
    if (!modulesMap[row.MODULEID]) {
      modulesMap[row.MODULEID] = {
        moduleId: row.MODULEID,
        moduleName: row.MODULENAME,
        moduleNo: row.MODULENO,
        screens: []
      };
    }
    
    const ops = permissionsMap[row.SCREENID] || '';
    
    modulesMap[row.MODULEID].screens.push({
      screenId: row.SCREENID,
      screenName: row.SCREENNAME,
      screenNo: row.SCREENNO,
      canView: ops.includes('V'),
      canAdd: ops.includes('A'),
      canEdit: ops.includes('E'),
      canDelete: ops.includes('D'),
      canApprove: ops.includes('P')
    });
  });

  // Convert map to array and sort
  const modules = Object.values(modulesMap).sort((a, b) => a.moduleNo - b.moduleNo);
  modules.forEach(m => m.screens.sort((a, b) => a.screenNo - b.screenNo));

  return modules;
}

async function saveRolePermissions(roleId, moduleData) {
  const permissionsToSave = [];
  
  moduleData.forEach(module => {
    module.screens.forEach(screen => {
      let ops = '';
      if (screen.canView) ops += 'V';
      if (screen.canEdit) ops += 'E';
      if (screen.canAdd) ops += 'A';
      if (screen.canDelete) ops += 'D';
      if (screen.canApprove) ops += 'P';
      
      // If at least one permission is checked, we save the row
      if (ops.length > 0) {
        permissionsToSave.push({
          screenId: screen.screenId,
          operations: ops
        });
      }
    });
  });

  return await roleModel.saveRolePermissions(roleId, permissionsToSave);
}

module.exports = {
  getRoles,
  getRolePermissionsData,
  saveRolePermissions
};
