const roleService = require('../services/roleService');
const logger = require('../utils/logger');

async function getRoles(req, res, next) {
  try {
    const roles = await roleService.getRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    logger.error('Error fetching roles: ' + error.message);
    next(error);
  }
}

async function getRolePermissions(req, res, next) {
  try {
    const { roleId } = req.params;
    const permissionsData = await roleService.getRolePermissionsData(roleId);
    res.json({ success: true, data: permissionsData });
  } catch (error) {
    logger.error('Error fetching role permissions: ' + error.message);
    next(error);
  }
}

async function saveRolePermissions(req, res, next) {
  try {
    const { roleId, modules } = req.body;
    if (!roleId || !modules) {
      return res.status(400).json({ success: false, message: 'Role ID and modules are required' });
    }
    
    await roleService.saveRolePermissions(roleId, modules);
    res.json({ success: true, message: 'Permissions saved successfully' });
  } catch (error) {
    logger.error('Error saving role permissions: ' + error.message);
    next(error);
  }
}

module.exports = {
  getRoles,
  getRolePermissions,
  saveRolePermissions
};
