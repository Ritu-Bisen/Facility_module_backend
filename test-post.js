const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:3001/api/contracts/31400/items', {
      lpItemId: "1",
      qty: "100",
      unitPrice: "1000"
    }, {
      headers: {
        'Authorization': 'Bearer test' // Might fail auth, but let's see. If the server crashes on auth, I will need a valid token.
      }
    });
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
})();
