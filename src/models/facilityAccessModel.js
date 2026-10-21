const db = require('../config/db');

// Setup the table if it doesn't exist (Utility function, usually run manually)
async function initFacilityTable() {
  let connection;
  try {
    connection = await db.getConnection();
    const checkSql = `SELECT count(*) as cnt FROM user_tables WHERE table_name = 'USRFACILITYSCREENS'`;
    const result = await connection.execute(checkSql);
    if (result.rows && result.rows[0] && (result.rows[0].CNT === 0 || result.rows[0].cnt === 0)) {
      await connection.execute(`
        CREATE TABLE USRFACILITYSCREENS (
            FacilityType VARCHAR2(50),
            ScreenID NUMBER,
            Operations VARCHAR2(10),
            EntryDate DATE,
            CONSTRAINT pk_usrfacilityscreens PRIMARY KEY (FacilityType, ScreenID)
        )
      `);
      console.log('Created USRFACILITYSCREENS table');
    }
  } catch (err) {
    console.error('Error checking/creating USRFACILITYSCREENS table:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {}
    }
  }
}

// Get only NEW modules and screens for the tree
async function getNewModulesAndScreens() {
  const sql = `
    SELECT m.ModuleID, m.ModuleName, m.ModuleNo, 
           s.ScreenID, s.ScreenName, s.ScreenURL, s.ScreenNo 
    FROM usrModules m
    JOIN usrScreens s ON s.ModuleID = m.ModuleID
    WHERE m.ISNEW = 'Y' AND s.ISSUBNEW = 'Y'
    ORDER BY m.ModuleNo, s.ScreenNo
  `;
  try {
    const result = await db.execute(sql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    if (result.rows && result.rows.length > 0) {
      return result.rows;
    }
    // If no rows have ISNEW='Y', fallback to all modules
    const fallbackSql = `
      SELECT m.ModuleID, m.ModuleName, m.ModuleNo, 
             s.ScreenID, s.ScreenName, s.ScreenURL, s.ScreenNo 
      FROM usrModules m
      JOIN usrScreens s ON s.ModuleID = m.ModuleID
      ORDER BY m.ModuleNo, s.ScreenNo
    `;
    const fallbackRes = await db.execute(fallbackSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    return fallbackRes.rows || [];
  } catch (err) {
    // Fallback if columns don't exist in dev DB (preventing crashes if ISNEW isn't actually there)
    console.error('Error fetching new modules/screens. Missing ISNEW column?', err.message);
    const fallbackSql = `
      SELECT m.ModuleID, m.ModuleName, m.ModuleNo, 
             s.ScreenID, s.ScreenName, s.ScreenURL, s.ScreenNo 
      FROM usrModules m
      JOIN usrScreens s ON s.ModuleID = m.ModuleID
      ORDER BY m.ModuleNo, s.ScreenNo
    `;
    const fallbackRes = await db.execute(fallbackSql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    return fallbackRes.rows || [];
  }
}

// Get assigned permissions for a specific facility type
async function getPermissionsByFacility(facilityType) {
  const sql = `
    SELECT ScreenID, Operations 
    FROM USRFACILITYSCREENS 
    WHERE FacilityType = :facilityType
  `;
  try {
    const result = await db.execute(sql, [facilityType], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    return result.rows || [];
  } catch(err) {
    console.error('Error getting facility permissions', err);
    return [];
  }
}

// Get all facility types
async function getAllFacilityTypes() {
  const sql = `SELECT FACILITYTYPECODE FROM MASFACILITYTYPES ORDER BY FACILITYTYPECODE`;
  try {
    const result = await db.execute(sql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
    return result.rows || [];
  } catch(err) {
    console.error('Error fetching facility types', err);
    return [];
  }
}

// Save permissions for a facility type
async function saveFacilityPermissions(facilityType, permissions) {
  // permissions: [{ screenId, operations: 'VEA' }]
  let connection;
  try {
    connection = await db.getConnection();
    const cleanType = String(facilityType || '').trim();

    // 1. Delete all previous permissions for this facility type
    await connection.execute(
      `DELETE FROM USRFACILITYSCREENS WHERE UPPER(TRIM(FacilityType)) = UPPER(TRIM(:cleanType))`,
      [cleanType]
    );
    await connection.commit();

    // 2. Insert the currently selected permissions
    if (permissions && permissions.length > 0) {
      const sql = `
        INSERT INTO USRFACILITYSCREENS (FacilityType, ScreenID, Operations, EntryDate) 
        VALUES (:facilityType, :screenId, :operations, SYSDATE)
      `;
      
      const binds = permissions.map(p => ({
        facilityType: cleanType,
        screenId: Number(p.screenId),
        operations: String(p.operations)
      }));
      
      await connection.executeMany(sql, binds, { autoCommit: false });
      await connection.commit();
    }
    
    return true;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error('Rollback error:', rbErr);
      }
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Connection close error:', err);
      }
    }
  }
}

module.exports = {
  initFacilityTable,
  getNewModulesAndScreens,
  getPermissionsByFacility,
  saveFacilityPermissions,
  getAllFacilityTypes
};
