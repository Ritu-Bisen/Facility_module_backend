const localItemsService = require('../services/localItemsService');

async function getCategories(req, res) {
  try {
    const categories = await localItemsService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

async function getItemTypes(req, res) {
  try {
    const types = await localItemsService.getItemTypes();
    res.json(types);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch item types' });
  }
}

async function getEdlItems(req, res) {
  try {
    const items = await localItemsService.getEdlItems();
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch EDL items' });
  }
}

async function getEdlItemDetails(req, res) {
  try {
    const details = await localItemsService.getEdlItemDetails(req.params.itemCode);
    if (!details) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(details);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch EDL item details' });
  }
}

async function getLocalItems(req, res) {
  try {
    const { categoryId } = req.query;
    const items = await localItemsService.getLocalItems(categoryId);
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch local items' });
  }
}

async function saveLocalItem(req, res) {
  try {
    const facilityId = req.user?.facilityId || req.body.facilityId || 104; // fallback to 104 if no user
    await localItemsService.saveLocalItem(req.body, facilityId);
    res.json({ message: 'Saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Failed to save local item' });
  }
}

async function deleteLocalItem(req, res) {
  try {
    await localItemsService.deleteLocalItem(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Failed to delete local item' });
  }
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
