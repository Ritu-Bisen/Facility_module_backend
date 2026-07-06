const fs = require('fs');
const file = 'Facility_Login_API.postman_collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const itemsFolder = data.item.find(i => i.name === 'Facility & Items API');
if (itemsFolder) {
  itemsFolder.item.push({
    name: "Get Item Types",
    request: {
      method: "GET",
      header: [
        {
          key: "Authorization",
          value: "Bearer {{accessToken}}"
        }
      ],
      url: {
        raw: "{{base_url}}/api/items/types",
        host: ["{{base_url}}"],
        path: ["api", "items", "types"]
      }
    }
  });
}

const storeFolder = data.item.find(i => i.name === 'Store endpoints');
if (storeFolder) {
  storeFolder.item.push({
    name: "Current Stock Batch Wise",
    request: {
      method: "GET",
      header: [
        {
          key: "Authorization",
          value: "Bearer {{accessToken}}"
        }
      ],
      url: {
        raw: "{{base_url}}/api/store/current-stock-batch-wise?facilityId=23246&itemTypeId=0",
        host: ["{{base_url}}"],
        path: ["api", "store", "current-stock-batch-wise"],
        query: [
          { key: "facilityId", value: "23246" },
          { key: "itemTypeId", value: "0" }
        ]
      }
    }
  });
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Collection updated successfully.');
