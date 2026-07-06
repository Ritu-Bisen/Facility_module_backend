const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const inFacilityTransferRoutes = require('./routes/inFacilityTransferRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ward-issue', require('./routes/wardIssueRoutes'));
app.use('/api/in-facility-transfer', inFacilityTransferRoutes);
app.use('/api/facility', require('./routes/facilityRoutes'));
app.use('/api/items', require('./routes/itemRoutes'));
app.use('/api/store', require('./routes/storeRoutes'));
app.use('/api/monthly-indent', require('./routes/monthlyIndentRoutes'));
app.use('/api/warehouse-receipt', require('./routes/warehouseReceiptRoutes'));
app.use('/api/shc-indents', require('./routes/shcIndentRoutes'));
app.use('/api/shc-indent-approvals', require('./routes/shcIndentApprovals'));
app.use('/api/shc-indent-approval', require('./routes/shcIndentItemRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
