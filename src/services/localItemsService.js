const localItemsModel = require('../models/localItemsModel');

async function getCategories() {
  return await localItemsModel.getCategories();
}

async function getItemTypes() {
  return await localItemsModel.getItemTypes();
}

async function getEdlItems() {
  return await localItemsModel.getEdlItems();
}

async function getEdlItemDetails(itemCode) {
  return await localItemsModel.getEdlItemDetails(itemCode);
}

async function getLocalItems(categoryId) {
  return await localItemsModel.getLocalItems(categoryId);
}

async function saveLocalItem(data, facilityId) {
  // Generate item code if NEDL
  if (!data.edlItemCode) {
    if (!data.itemCode || data.itemCode === '') {
      data.itemCode = await localItemsModel.generateNextLpCode();
    }
  }

  // Validate duplicate
  const isDuplicate = await localItemsModel.checkDuplicate(
    data.itemCode,
    data.itemName,
    data.strength,
    data.lpItemId,
    facilityId
  );
  if (isDuplicate) {
    throw new Error("Item Code or Description/Strength already exists for this facility.");
  }

  // Insert or Update
  if (!data.lpItemId || data.lpItemId === '0' || data.lpItemId === '') {
    await localItemsModel.createLocalItem(data, facilityId);
  } else {
    // If updating, check if it's already used in contracts or receipts
    const isUsed = await localItemsModel.checkItemUsed(data.lpItemId);
    if (isUsed) {
      throw new Error("Cannot edit the Local Item as it has been used in Local Contract or Opening Stock");
    }
    await localItemsModel.updateLocalItem(data);
  }
}

async function deleteLocalItem(lpItemId) {
  const isUsed = await localItemsModel.checkItemUsed(lpItemId);
  if (isUsed) {
    throw new Error("Cannot delete the Local Item as it has been used in Local Contract or Opening Stock");
  }
  await localItemsModel.deleteLocalItem(lpItemId);
}

module.exports = {
  getCategories,
  getItemTypes,
  getEdlItems,
  getEdlItemDetails,
  getLocalItems,
  saveLocalItem,
  deleteLocalItem
};
