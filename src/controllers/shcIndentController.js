const { getShcIndents } = require('../models/shcIndentModel');
const db = require('../config/db');
const oracledb = require('oracledb');

const fetchShcIndents = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const accYrSetId = req.query.accYrSetId;
        const status = req.query.status || 'All';

        if (!accYrSetId) {
            return res.status(400).json({ success: false, message: 'accYrSetId is required' });
        }

        const data = await getShcIndents(facilityId, accYrSetId, status);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in fetchShcIndents:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SHC indents' });
    }
};

const getAccYears = async (req, res) => {
    try {
        const query = `
            SELECT 
                ACCYRSETID as "id",
                AccYear as "year"
            FROM masAccYearSettings
            ORDER BY AccYear DESC
        `;
        const result = await db.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json({ success: true, data: result.rows || [] });
    } catch (error) {
        console.error('Error in getAccYears:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch financial years' });
    }
};

module.exports = {
    fetchShcIndents,
    getAccYears
};
