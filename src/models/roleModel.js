const db = require('../config/db');

async function getRoles() {
  const sql = `SELECT RoleID, RoleName FROM usrRoles ORDER BY RoleName`;
  const result = await db.execute(sql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

async function getAllModulesAndScreens() {
  const sql = `
    SELECT m.ModuleID, m.ModuleName, m.ModuleNo, s.ScreenID, s.ScreenName, s.ScreenURL, s.ScreenNo 
    FROM usrModules m
    JOIN usrScreens s ON s.ModuleID = m.ModuleID
    ORDER BY m.ModuleNo, s.ScreenNo
  `;
  const result = await db.execute(sql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

async function getRolePermissions(roleId) {
  const sql = `
    SELECT ScreenID, Operations 
    FROM usrScreenOpsByRole 
    WHERE RoleID = :roleId
  `;
  const result = await db.execute(sql, [roleId], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

async function saveRolePermissions(roleId, permissions) {
  // permissions is an array of { screenId, operations: 'VEA' }
  let connection;
  try {
    connection = await db.getConnection();
    // Delete existing permissions for this role
    await connection.execute(`DELETE FROM usrScreenOpsByRole WHERE RoleID = :roleId`, [Number(roleId)]);
    await connection.commit();

    if (permissions && permissions.length > 0) {
      const sql = `
        INSERT INTO usrScreenOpsByRole (RoleID, ScreenID, Operations, EntryDate) 
        VALUES (:roleId, :screenId, :operations, SYSDATE)
      `;
      
      const binds = permissions.map(p => ({
        roleId: Number(roleId),
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
      } catch (rbErr) {}
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

module.exports = {
  getRoles,
  getAllModulesAndScreens,
  getRolePermissions,
  saveRolePermissions
};
