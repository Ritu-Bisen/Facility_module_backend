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
  const connection = await db.oracledb.getConnection(db.poolAlias || 'default');
  try {
    // Delete existing permissions for this role
    await connection.execute(`DELETE FROM usrScreenOpsByRole WHERE RoleID = :roleId`, [roleId]);

    if (permissions && permissions.length > 0) {
      // Get the next ID from sequence if exists, or max + 1. Since we don't know the exact sequence name, 
      // let's do a max + rownum logic or assume there's a sequence/trigger.
      // Usually CGMSC Oracle DBs have triggers for primary keys on insert, let's assume it does.
      
      const sql = `
        INSERT INTO usrScreenOpsByRole (RoleID, ScreenID, Operations, EntryDate) 
        VALUES (:roleId, :screenId, :operations, SYSDATE)
      `;
      
      const binds = permissions.map(p => ({
        roleId: roleId,
        screenId: p.screenId,
        operations: p.operations
      }));
      
      await connection.executeMany(sql, binds, { autoCommit: false });
    }
    
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
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
