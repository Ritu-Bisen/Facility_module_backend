const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const inFacilityTransferRoutes = require('./routes/inFacilityTransferRoutes');
const breakageVoucherRoutes = require('./routes/breakageVoucherRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ward-issue', require('./routes/wardIssueRoutes'));
app.use('/api/in-facility-transfer', inFacilityTransferRoutes);
app.use('/api/breakage-voucher', breakageVoucherRoutes);
app.use('/api/facility', require('./routes/facilityRoutes'));
app.use('/api/items', require('./routes/itemRoutes'));
app.use('/api/store', require('./routes/storeRoutes'));
app.use('/api/monthly-indent', require('./routes/monthlyIndentRoutes'));
app.use('/api/warehouse-receipt', require('./routes/warehouseReceiptRoutes'));
app.use('/api/in-facility-receipt', require('./routes/inFacilityReceiptRoutes'));
app.use('/api/shc-indents', require('./routes/shcIndentRoutes'));
app.use('/api/shc-inter-facility-transfers', require('./routes/shcInterFacilityRoutes'));
app.use('/api/shc-indent-approvals', require('./routes/shcIndentApprovals'));
app.use('/api/shc-indent-approval', require('./routes/shcIndentItemRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/testing', require('./routes/testingRoutes'));
app.use('/api/facility-wards', require('./routes/facilityWardRoutes'));
app.use('/api/facility-info', require('./routes/facilityInfoRoutes'));
app.use('/api/storage-locations', require('./routes/storageLocationRoutes'));
app.use('/api/special-locations', require('./routes/spLocationRoutes'));
app.use('/api/doctor-info', require('./routes/doctorInfoRoutes'));
app.use('/api/indent-to-other-facility', require('./routes/indentToOtherFacilityRoutes'));
app.use('/api/inter-facility-issue-online', require('./routes/interFacilityIssueOnlineRoutes'));
app.use('/api/online-transfer-items', require('./routes/onlineTransferItemsRoutes'));
app.use('/api/noc-approval', require('./routes/nocApprovalRoutes'));
app.use('/api/stock-register', require('./routes/stockRegisterRoutes'));
app.use('/api/annual-indent', require('./routes/annualIndentRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/facility-access', require('./routes/facilityAccessRoutes'));
// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
