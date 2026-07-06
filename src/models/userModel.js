const db = require('../config/db');

async function findAll() {
  const sql = `SELECT * FROM users`;
  // Using outFormat: db.oracledb.OUT_FORMAT_OBJECT if needed
  const result = await db.execute(sql);
  return result.rows;
}

async function findById(id) {
  const sql = `SELECT * FROM users WHERE id = :id`;
  const result = await db.execute(sql, [id]);
  return result.rows[0];
}

module.exports = {
  findAll,
  findById
};
