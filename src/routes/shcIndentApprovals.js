const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const db = require("../config/db");
const { authenticate } = require('../middleware/authMiddleware');

router.get("/", authenticate, async (req, res) => {
  try {
    const { facilityId, accYrSetId, status } = req.query;

    let query = `
      SELECT
          a.NOCID,
          a.NOCNUMBER,
          TO_CHAR(a.NOCDATE,'DD-MM-YYYY') AS NOCDATE,
          a.STATUS,
          ay.ACCYEAR,
          f.FACILITYID,
          f.FACILITYNAME,
          d.DISTRICTNAME,
          NVL(a.ISPFACAPPROVAL, 'N') AS ISPFACAPPROVAL
      FROM MASCGMSCNOC a
      INNER JOIN MASACCYEARSETTINGS ay
          ON ay.ACCYRSETID = a.ACCYRSETID
      INNER JOIN MASFACILITIES f
          ON f.FACILITYID = a.FACILITYID
      INNER JOIN MASDISTRICTS d
          ON d.DISTRICTID = f.DISTRICTID
      WHERE a.FACILITYID = :facilityId
        AND a.ACCYRSETID = :accYrSetId
        AND NVL(a.ISPFACAPPROVAL, 'N') IN ('N','Y')
    `;

    const binds = {
      facilityId: Number(facilityId),
      accYrSetId: Number(accYrSetId),
    };

    // Status Filter
    if (status === "I") {
      query += ` AND a.STATUS = 'I'`;
    }

    if (status === "C") {
      query += ` AND a.STATUS = 'C'`;
    }

    query += ` ORDER BY a.NOCDATE DESC`;

    const result = await db.execute(
      query,
      binds,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
