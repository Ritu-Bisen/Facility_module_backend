const app = require('./app');
const { initialize } = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

async function startup() {
  try {
    logger.info('Starting application...');
    await initialize();
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup error: ' + err.message);
    process.exit(1);
  }
}

startup();