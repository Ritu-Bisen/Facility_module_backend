const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('http://localhost:3001/api/contracts/supply-order?accyrsetid=542&lpsupplierid=1378', {
      headers: {
        'Authorization': 'Bearer test' // Might return 401 if token is invalid, let's see
      }
    });
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error(err.message);
    }
  }
})();
