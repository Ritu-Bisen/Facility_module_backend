const userModel = require('../models/userModel');

async function getAllUsers() {
  return await userModel.findAll();
}

async function getUserById(id) {
  return await userModel.findById(id);
}

module.exports = {
  getAllUsers,
  getUserById
};
