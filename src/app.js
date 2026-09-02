const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const inFacilityTransferRoutes = require('./routes/inFacilityTransferRoutes');
const breakageVoucherRoutes = require('./routes/breakageVoucherRoutes');
const userLogRoutes = require('./routes/userLogRoutes');
const { logActivityMiddleware } = require('./middleware/logMiddleware');
const { errorHandler } = require('./middleware/errorMiddleware');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.disable('x-powered-by');

// Strip technology version disclosure headers & restrict HTTP methods (CWE-200 / Vulnerability Point No. 21)
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.removeHeader('Allow');
  res.removeHeader('Public');

  // Block dangerous/unnecessary HTTP methods
  const disallowedMethods = ['TRACE', 'TRACK', 'DEBUG'];
  if (disallowedMethods.includes(req.method.toUpperCase())) {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  next();
});

const helmet = require('helmet');

// Implement Security Headers using Helmet
app.use(
  helmet({
    // Set X-Frame-Options: DENY
    frameguard: {
      action: 'deny',
    },
    // Enforce nosniff explicitly (Helmet does this by default, but we declare it for CWE-693 compliance)
    xContentTypeOptions: true,
    // Enforce strict HSTS (CWE-693)
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    // Set strict Content-Security-Policy
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "default-src": ["'self'"],
        "script-src": ["'self'"], // Removed 'unsafe-inline' as per STQC recommendations
        "style-src": ["'self'"], // Removed 'unsafe-inline' as per STQC recommendations
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://dpdmis.in", "http://localhost:5173"],
        "frame-ancestors": ["'none'"],
      },
    },
  })
);
const allowedOrigins = ['https://dpdmis.in', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., server-to-server) or from allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Enable if cookies/authorization headers are needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Restrict to necessary methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Restrict to necessary headers
};

app.use(cors(corsOptions));
app.use(express.json());

const sanitizeMiddleware = require('./middleware/sanitizeMiddleware');
app.use(sanitizeMiddleware);

// Automatic logging to USERS_LOGS table for all API operations (Disabled for now)
// app.use(logActivityMiddleware);

// Routes
app.get('/api/user', require('./controllers/userController').getTenUsers);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-logs', userLogRoutes);
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
app.use('/api/local-purchase', require('./routes/localPurchaseRoutes'));
app.use('/api/ayush-local-purchase', require('./routes/ayushLocalPurchaseRoutes'));
app.use('/api/contracts', require('./routes/contractRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/facility-access', require('./routes/facilityAccessRoutes'));
app.use('/api/local-items', require('./routes/localItemsRoutes'));
app.use('/api/noc-cancellation', require('./routes/nocCancellationRoutes'));
app.use('/api/return-to-warehouse', require('./routes/returnToWarehouseRoutes'));
app.use('/api/reagent-indent', require('./routes/reagentIndentRoutes'));

// 404 Handler for unmatched API routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
});

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
