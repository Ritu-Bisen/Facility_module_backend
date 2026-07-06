const db = require('../config/db');
const oracledb = require('oracledb');

exports.getIndentHeader = async (req, res) => {
  try {
    const { nocId } = req.params;

    const query = `
      SELECT
          a.NOCID,
          a.NOCNUMBER,
          TO_CHAR(a.NOCDATE,'DD-MM-YYYY') AS NOCDATE,
          f.FACILITYID,
          f.FACILITYNAME,
          d.DISTRICTNAME,
          p.PROGRAM,
          a.MNOCID,
          a.STATUS,
          a.ISPFACAPPROVAL
      FROM MASCGMSCNOC a
      INNER JOIN MASFACILITIES f
          ON f.FACILITYID = a.FACILITYID
      LEFT JOIN MASDISTRICTS d
          ON d.DISTRICTID = f.DISTRICTID
      LEFT JOIN MASPROGRAM p
          ON p.PROGRAMID = a.PROGRAMID
      WHERE a.NOCID = :nocId
      AND NVL(a.ISPFACAPPROVAL,'N') IN ('N','Y')
    `;

    const binds = { nocId: Number(nocId) };
    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'NOC Header not found' });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching NOC header:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getIndentItems = async (req, res) => {
  try {
    const { nocId } = req.params;

    const query = `
      SELECT
          i.SR,
          i.ITEMID,
          i.REQUESTEDQTY,
          NVL(i.BOOKEDQTY,i.REQUESTEDQTY) AS APPROVEDQTY,
          m.ITEMCODE,
          m.ITEMNAME,
          m.STRENGTH1,
          m.UNIT,
          m.UNITCOUNT,
          CASE
            WHEN NVL(i.ISPAPPROVED,'N')='Y'
            THEN 'Yes'
            ELSE 'No'
          END APRSTATUS,
          (SELECT ITEMTYPENAME FROM MASITEMTYPES WHERE ITEMTYPEID = m.ITEMTYPEID) AS ITEMTYPE
      FROM MASCGMSCNOCITEMS i
      INNER JOIN MASITEMS m
          ON m.ITEMID = i.ITEMID
      WHERE i.NOCID = :nocId
      ORDER BY i.SR
    `;

    const binds = { nocId: Number(nocId) };
    const result = await db.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching NOC items:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveItem = async (req, res) => {
  try {
    const { sr, nocId, itemId, approvedQty } = req.body;

    const query = `
      UPDATE MASCGMSCNOCITEMS
      SET BOOKEDQTY = :approvedQty,
          ISPAPPROVED = 'Y'
      WHERE SR = :sr
    `;

    const binds = {
      approvedQty: Number(approvedQty),
      sr: Number(sr)
    };

    await db.execute(query, binds, { autoCommit: true });

    return res.status(200).json({ success: true, message: 'Item approved successfully' });
  } catch (error) {
    console.error('Error approving item:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeIndent = async (req, res) => {
  try {
    const { nocId } = req.params;

    const validationQuery = `
      SELECT COUNT(*) AS TOTAL_ITEMS,
             SUM(CASE WHEN NVL(ISPAPPROVED,'N')='Y' THEN 1 ELSE 0 END) AS APPROVED_ITEMS
      FROM MASCGMSCNOCITEMS
      WHERE NOCID = :nocId
    `;
    const vBinds = { nocId: Number(nocId) };
    const vResult = await db.execute(validationQuery, vBinds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    if (vResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No items found for this NOC' });
    }

    const { TOTAL_ITEMS, APPROVED_ITEMS } = vResult.rows[0];

    if (TOTAL_ITEMS !== APPROVED_ITEMS) {
      return res.status(400).json({
        success: false,
        message: 'All items must be approved before completion.'
      });
    }

    const updateQuery = `
      UPDATE MASCGMSCNOC
      SET STATUS='C',
          ISPFACAPPROVAL='Y',
          ISPFACAPPROVALDT=SYSDATE
      WHERE NOCID=:nocId
    `;
    const updateBinds = { nocId: Number(nocId) };
    await db.execute(updateQuery, updateBinds, { autoCommit: true });

    return res.status(200).json({ success: true, message: 'NOC completed successfully' });
  } catch (error) {
    console.error('Error completing NOC:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
