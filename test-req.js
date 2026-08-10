const request = require('supertest');
const app = require('./src/app');

request(app)
  .get('/api/reports/hold-batches')
  .expect(200)
  .end((err, res) => {
    console.log(res.status);
    console.log(res.text);
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
