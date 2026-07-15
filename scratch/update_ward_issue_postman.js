const fs = require('fs');

const collectionPath = '../Facility_API_Collection.postman_collection.json';
const data = fs.readFileSync(collectionPath, 'utf8');
const collection = JSON.parse(data);

function updateBody(method, urlPattern, bodyStr) {
  for (const folder of collection.item) {
    if (folder.item) {
      for (const req of folder.item) {
        if (req.request && req.request.method === method && req.name.includes(urlPattern)) {
          req.request.body = {
            mode: "raw",
            raw: bodyStr
          };
          if (!req.request.header) req.request.header = [];
          if (!req.request.header.find(h => h.key === 'Content-Type')) {
            req.request.header.push({ key: "Content-Type", value: "application/json" });
          }
        }
      }
    }
  }
}

const headerBody = JSON.stringify({
  facilityId: 123,
  wardId: 456,
  issueNo: "WI-1001",
  requestedBy: "Nurse Joy",
  requestedDt: "2023-10-01",
  issueDate: "2023-10-02"
}, null, 2);

const itemBody = JSON.stringify({
  itemId: 789,
  curStock: 100,
  allotted: 50,
  issueQty: 20
}, null, 2);

updateBody('POST', 'POST /api/ward-issue', headerBody);
updateBody('PUT', 'PUT /api/ward-issue/:id', headerBody);
updateBody('POST', 'POST /api/ward-issue/:id/items', itemBody);
updateBody('PUT', 'PUT /api/ward-issue/items/:issueItemId', itemBody);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
console.log("Postman collection updated successfully.");
