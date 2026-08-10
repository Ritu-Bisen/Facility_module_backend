const express = require('express');
const router = express.Router();
const localItemsController = require('../controllers/localItemsController');

router.get('/categories', localItemsController.getCategories);
router.get('/item-types', localItemsController.getItemTypes);
router.get('/edl-items', localItemsController.getEdlItems);
router.get('/edl-items/:itemCode', localItemsController.getEdlItemDetails);
router.get('/', localItemsController.getLocalItems);
router.post('/', localItemsController.saveLocalItem);
router.delete('/:id', localItemsController.deleteLocalItem);

module.exports = router;
