const fs = require('fs');

const collectionPath = './Facility_API_Collection.postman_collection.json';
const data = fs.readFileSync(collectionPath, 'utf8');
const collection = JSON.parse(data);

const mastersFolder = {
  "name": "Masters (Facility Info, Wards, Locations, Doctors)",
  "description": "Endpoints for master data management under the Masters menu.",
  "item": [
    // Facility Info
    {
      "name": "GET /api/facility-info",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-info",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-info"]
        }
      }
    },
    {
      "name": "POST /api/facility-info",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-info",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-info"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"header1\": \"Dept of Health\",\n  \"header2\": \"Hospital\",\n  \"header3\": \"City\",\n  \"footer1\": \"Thank you\",\n  \"footer2\": \"Visit again\",\n  \"footer3\": \"Website\",\n  \"drName\": \"Dr. Smith\",\n  \"mobile\": \"9876543210\",\n  \"email\": \"doctor@hospital.com\"\n}"
        }
      }
    },
    // Facility Wards
    {
      "name": "GET /api/facility-wards",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-wards",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-wards"]
        }
      }
    },
    {
      "name": "POST /api/facility-wards",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-wards",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-wards"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"wardName\": \"ICU Ward\",\n  \"isOpd\": 0\n}"
        }
      }
    },
    {
      "name": "PUT /api/facility-wards/:wardId",
      "request": {
        "method": "PUT",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-wards/123",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-wards", "123"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"wardName\": \"General Ward\",\n  \"isOpd\": 1\n}"
        }
      }
    },
    {
      "name": "DELETE /api/facility-wards/:wardId",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/facility-wards/123",
          "host": ["{{base_url}}"],
          "path": ["api", "facility-wards", "123"]
        }
      }
    },
    // Storage Locations
    {
      "name": "GET /api/storage-locations",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/storage-locations",
          "host": ["{{base_url}}"],
          "path": ["api", "storage-locations"]
        }
      }
    },
    {
      "name": "POST /api/storage-locations",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/storage-locations",
          "host": ["{{base_url}}"],
          "path": ["api", "storage-locations"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"locationno\": \"Rack A1\"\n}"
        }
      }
    },
    {
      "name": "PUT /api/storage-locations/:rackId",
      "request": {
        "method": "PUT",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/storage-locations/123",
          "host": ["{{base_url}}"],
          "path": ["api", "storage-locations", "123"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"locationno\": \"Rack B2\"\n}"
        }
      }
    },
    {
      "name": "DELETE /api/storage-locations/:rackId",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/storage-locations/123",
          "host": ["{{base_url}}"],
          "path": ["api", "storage-locations", "123"]
        }
      }
    },
    // Special Receipt Locations
    {
      "name": "GET /api/special-locations",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/special-locations",
          "host": ["{{base_url}}"],
          "path": ["api", "special-locations"]
        }
      }
    },
    {
      "name": "POST /api/special-locations",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/special-locations",
          "host": ["{{base_url}}"],
          "path": ["api", "special-locations"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"locationno\": \"Special Zone 1\"\n}"
        }
      }
    },
    {
      "name": "PUT /api/special-locations/:id",
      "request": {
        "method": "PUT",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/special-locations/123",
          "host": ["{{base_url}}"],
          "path": ["api", "special-locations", "123"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"locationno\": \"Special Zone 2\"\n}"
        }
      }
    },
    {
      "name": "DELETE /api/special-locations/:id",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/special-locations/123",
          "host": ["{{base_url}}"],
          "path": ["api", "special-locations", "123"]
        }
      }
    },
    // Doctor Info
    {
      "name": "GET /api/doctor-info",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/doctor-info",
          "host": ["{{base_url}}"],
          "path": ["api", "doctor-info"]
        }
      }
    },
    {
      "name": "POST /api/doctor-info",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/doctor-info",
          "host": ["{{base_url}}"],
          "path": ["api", "doctor-info"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"drName\": \"Dr. John Doe\",\n  \"mobileNo\": \"9876543210\"\n}"
        }
      }
    },
    {
      "name": "PUT /api/doctor-info/:drId",
      "request": {
        "method": "PUT",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": {
          "raw": "{{base_url}}/api/doctor-info/123",
          "host": ["{{base_url}}"],
          "path": ["api", "doctor-info", "123"]
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"drName\": \"Dr. Jane Doe\",\n  \"mobileNo\": \"9998887776\"\n}"
        }
      }
    },
    {
      "name": "DELETE /api/doctor-info/:drId",
      "request": {
        "method": "DELETE",
        "header": [
          { "key": "Authorization", "value": "Bearer {{accessToken}}" }
        ],
        "url": {
          "raw": "{{base_url}}/api/doctor-info/123",
          "host": ["{{base_url}}"],
          "path": ["api", "doctor-info", "123"]
        }
      }
    }
  ]
};

// Check if Masters folder already exists
const existingIndex = collection.item.findIndex(i => i.name.startsWith("Masters"));
if (existingIndex !== -1) {
  collection.item[existingIndex] = mastersFolder;
} else {
  collection.item.push(mastersFolder);
}

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
console.log("Postman collection updated successfully.");
