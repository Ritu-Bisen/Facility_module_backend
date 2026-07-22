const userModel = require('../models/userModel');

async function getAllUsers() {
  return await userModel.findAll();
}

async function getUserById(id) {
  return await userModel.findById(id);
}

async function getExtendedUserInfo(id) {
  const [userInfo, roleInfo, lastLogin] = await Promise.all([
    userModel.getUserInfo(id),
    userModel.getRoleInfo(id),
    userModel.getLastLogin(id)
  ]);
  
  return {
    userInfo: userInfo || {},
    roleInfo: roleInfo || {},
    lastLogin: lastLogin || {}
  };
}

async function getUserMenus(id) {
  const modules = await userModel.getModules(id) || [];
  
  const menuTree = await Promise.all(
    modules.map(async (mod) => {
      const screens = await userModel.getScreens(id, mod.MODULEID || mod.moduleid);
      return {
        ...mod,
        screens: screens || []
      };
    })
  );
  
  return menuTree;
}

module.exports = {
  getAllUsers,
  getUserById,
  getExtendedUserInfo,
  getUserMenus
};
