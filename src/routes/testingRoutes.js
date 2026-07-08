const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/', (req, res) => {
    try {
        const dataPath = path.join(__dirname, '../data/testingData.json');
        const data = fs.readFileSync(dataPath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading testing data:', error);
        res.status(500).json({ error: 'Failed to read testing data' });
    }
});

module.exports = router;
