const db = require('../src/config/db');
const oracledb = require('oracledb');

async function run() {
  try {
    await db.initialize();

    console.log("=== TESTING COALESCE CATEGORY RESOLUTION ===");
    const res = await db.execute(
      `select a.indentid, a.indentno, a.aicategoryid,
              coalesce(
                (select sub.catname || ' (' || mc2.categoryname || ')' from massubitemcategory sub inner join masitemcategories mc2 on mc2.categoryid = sub.categoryid where sub.subcatid = a.AIcategoryid),
                mc.categoryname,
                (select min(mc3.categoryname) from anualindent ai inner join masitems m on m.itemid = ai.itemid inner join masitemcategories mc3 on mc3.categoryid = m.categoryid where ai.indentid = a.indentid),
                'General'
              ) categoryname
       from masAnualIndent a
       left outer join masitemcategories mc on mc.categoryid = a.AIcategoryid
       where ROWNUM <= 15
       order by a.indentid desc`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(res.rows);

    console.log("\n=== TESTING CATEGORIES DROPDOWN ===");
    const catRes = await db.execute(
      `select s.subcatid as categoryid, 
              s.catname || ' (' || c.categoryname || ')' as categoryname
       from massubitemcategory s
       inner join masitemcategories c on c.categoryid = s.categoryid
       union all
       select c.categoryid as categoryid,
              c.categoryname as categoryname
       from masitemcategories c
       where c.categoryid not in (select distinct categoryid from massubitemcategory where categoryid is not null)
       order by categoryname`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(catRes.rows);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
