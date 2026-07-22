const userService = require('../services/userService');
const logger = require('../utils/logger');

async function getUsers(req, res, next) {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
}

async function getMyInfo(req, res, next) {
  try {
    const userId = req.user.userId; // assuming auth middleware sets this
    const info = await userService.getExtendedUserInfo(userId);
    res.json(info);
  } catch (error) {
    next(error);
  }
}

async function getMyMenus(req, res, next) {
  try {
    const userId = req.user.userId;
    const menus = await userService.getUserMenus(userId);
    res.json(menus);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getUser,
  getMyInfo,
  getMyMenus
};
