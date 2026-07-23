const db = require('../config/db');

async function findAll() {
  const sql = `SELECT * FROM users`;
  // Using outFormat: db.oracledb.OUT_FORMAT_OBJECT if needed
  const result = await db.execute(sql);
  return result.rows;
}

async function findTenRows() {
  const sql = `SELECT * FROM usrUsers WHERE ROWNUM <= 10`;
  const result = await db.execute(sql, [], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

async function findById(id) {
  const sql = `SELECT * FROM users WHERE id = :id`;
  const result = await db.execute(sql, [id]);
  return result.rows[0];
}

async function getUserInfo(id) {
  const sql = `
    Select usr.EmailID 
    ,usr.FirstName || ' ' || NVL(usr.LastName, '') as DisplayName 
    ,usr.SourceID 
    ,src.SourceName 
    ,usr.SchemeID 
    ,sch.SchemeName 
    ,st.StateID 
    ,st.StateName 
    ,usr.DivisionID 
    ,div.DivisionName 
    ,usr.PSAID 
    ,psa.PSAName 
    ,usr.WarehouseID 
    ,war.WarehouseName 
    ,usr.FacilityID 
    ,fac.FacilityName 
    ,usr.SupplierID 
    ,(case when usr.IsLocalSuppliers=0 then sup.SupplierName else lpsup.SupplierName end) SupplierName 
    ,dis.DistrictID 
    ,dis.DistrictName 
    ,usr.UserType 
    from usrUsers usr 
    Left Outer Join masSources src on (src.SourceID=usr.SourceID) 
    Left Outer Join masSchemes sch on (sch.SchemeID=usr.SchemeID) 
    Left Outer Join masStates st on (st.StateID=usr.StateID) 
    Left Outer Join masWarehouses war on (war.WarehouseID=usr.WarehouseID) 
    Left Outer Join masFacilities fac on (fac.FacilityID=usr.FacilityID) 
    Left Outer Join masSuppliers sup on (sup.SupplierID=usr.SupplierID) 
    Left Outer Join LPmasSuppliers lpsup on (lpsup.LPSupplierID = usr.SupplierID)
    Left Outer Join masPSAs psa on (psa.PSAID=usr.PSAID) 
    Left Outer Join masDivisions div on (div.DivisionID=usr.DivisionID) 
    Left Outer Join masDistricts dis on (dis.DistrictID=usr.DistrictID) 
    Where usr.UserID = :id
  `;
  const result = await db.execute(sql, [id], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows[0];
}

async function getRoleInfo(id) {
  const sql = `
    Select usr.RoleID, ro.AllowChangePWD 
    from usrUsers usr 
    Inner Join usrRoles ro on (ro.RoleID = usr.RoleID) 
    Where usr.UserID = :id
  `;
  const result = await db.execute(sql, [id], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows[0];
}

async function getLastLogin(id) {
  const sql = `
    WITH LoginDates AS ( 
        SELECT UserID, LOGDATE, IPAddress as IP 
        FROM GENAUDITLOGS 
        WHERE OPERATION = 0 and UserID = :id 
    ), 
    RankedLoginDate AS ( 
        SELECT ROW_NUMBER() OVER (ORDER BY LOGDATE DESC) AS RankNo, LogDate, IP FROM LoginDates 
    ) 
    SELECT ' Last Log In : ' || To_Char(LogDate,'MON DD YYYY HH:MI:SS A.M.') || ' IST' || ' ( ' || IP || ' )' AS LastActivityOn 
    from RankedLoginDate Where RankNo = 2
  `;
  const result = await db.execute(sql, [id], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows[0];
}

async function getModules(id) {
  const sql = `
    Select distinct a.ModuleID, a.ModuleName, a.ModuleURL, a.ModuleNo 
    from usrModules a 
    Inner Join usrScreens a1 on (a1.ModuleID = a.ModuleID) 
    Inner Join usrScreenOpsByRole a2 on (a2.ScreenID = a1.ScreenID) 
    Inner Join usrRoles a3 on (a3.RoleID = a2.RoleID) 
    Inner Join usrUsers a4 on (a4.RoleID = a3.RoleID) 
    Where a4.UserID = :id 
    Order by a.ModuleNo
  `;
  const result = await db.execute(sql, [id], { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

async function getScreens(userId, moduleId) {
  const sql = `
    Select b4.ScreenID, b4.ScreenName, b4.ScreenURL, b4.ScreenNo 
    from usrUsers b1 
    Inner Join usrRoles b2 on (b2.RoleID = b1.RoleID) 
    Inner Join usrScreenOpsByRole b3 on (b3.RoleID = b2.RoleID) 
    Inner Join usrScreens b4 on (b4.ScreenID = b3.ScreenID) 
    Where b4.ModuleID = :moduleId and b1.UserID = :userId 
    Order by b4.ScreenNo
  `;
  const result = await db.execute(sql, { userId, moduleId }, { outFormat: db.oracledb?.OUT_FORMAT_OBJECT || 4002 });
  return result.rows;
}

module.exports = {
  findAll,
  findById,
  getUserInfo,
  getRoleInfo,
  getLastLogin,
  getModules,
  getScreens,
  findTenRows
};
