const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * Append a synthetic TEST_ONLY record to Google Sheets
 * Columns: A = Demo Username, B = Demo Password, C = Timestamp, D = Status/Test Flag
 *
 * @param {Object} testRecord
 * @param {string} testRecord.demoUsername - Fixed synthetic username (e.g. 'TEST_USER')
 * @param {string} testRecord.demoPassword - Fixed synthetic test password (e.g. 'TEST_PASSWORD_123')
 * @param {string} testRecord.timestamp - Timestamp string
 * @param {string} testRecord.status - Test flag (e.g. 'TEST_ONLY')
 */
async function appendTestRowToGoogleSheets({ demoUsername, demoPassword, timestamp, status }) {
  const spreadsheetId = (process.env.SPREADSHEET_ID || '').trim();
  const keyFilePath = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json');

  // Diagnostic 1: Verify Key File existence and path
  console.log('\n--- [Google Sheets Diagnostic Start] ---');
  console.log('1. Service Account Key File:', keyFilePath);
  const keyFileExists = fs.existsSync(keyFilePath);
  console.log('   File Exists:', keyFileExists);

  if (!keyFileExists) {
    console.log('--- [Google Sheets Diagnostic End] ---\n');
    throw new Error(
      `Service Account JSON file not found at: ${keyFilePath}. Please place 'google-service-account.json' in your project root.`
    );
  }

  // Diagnostic 2 & 4: Load and print client_email & project_id safely (NO private_key or full JSON)
  let keyData;
  try {
    keyData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
  } catch (err) {
    console.log('--- [Google Sheets Diagnostic End] ---\n');
    throw new Error(`Failed to parse Service Account JSON: ${err.message}`);
  }

  console.log('2. Client Email:', keyData.client_email || 'NOT_FOUND');
  console.log('3. Google Cloud Project ID:', keyData.project_id || 'NOT_FOUND');

  // Diagnostic 3: Loaded Spreadsheet ID
  console.log('4. Loaded SPREADSHEET_ID:', spreadsheetId || '(EMPTY)');
  console.log('   SPREADSHEET_ID Length:', spreadsheetId.length, 'characters');

  if (!spreadsheetId || spreadsheetId === 'YOUR_SPREADSHEET_ID') {
    console.log('--- [Google Sheets Diagnostic End] ---\n');
    throw new Error('SPREADSHEET_ID is not configured in .env. Please provide your Google Sheet ID.');
  }

  // Authenticate
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Diagnostic 5 & 6: Test spreadsheet metadata access (sheets.spreadsheets.get)
  console.log('5. Calling sheets.spreadsheets.get to verify metadata access...');
  let sheetMetadata;
  try {
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    sheetMetadata = metaRes.data;
    console.log('   Metadata Access: SUCCESS');
    console.log('   Spreadsheet Title:', sheetMetadata.properties ? sheetMetadata.properties.title : 'Untitled');
  } catch (metaErr) {
    const statusCode = metaErr.status || (metaErr.response && metaErr.response.status) || metaErr.code || 'UNKNOWN';
    const reason = metaErr.response && metaErr.response.data && metaErr.response.data.error
      ? (metaErr.response.data.error.status || metaErr.response.data.error.message)
      : metaErr.message;

    console.log('   Metadata Access: FAILED');
    console.log('   HTTP Status Code:', statusCode);
    console.log('   Google API Error Reason:', reason);
    console.log('--- [Google Sheets Diagnostic End] ---\n');

    if (statusCode === 404) {
      throw new Error(
        `Google Sheets API Error (HTTP 404 NOT_FOUND): Spreadsheet ID "${spreadsheetId}" (${spreadsheetId.length} chars) was not found or has not been shared with "${keyData.client_email}".`
      );
    }

    throw new Error(`Google Sheets API Error (HTTP ${statusCode}): ${reason}`);
  }

  // Diagnostic 7: Verify worksheet/tab named "Data" exists
  const existingTabs = (sheetMetadata.sheets || []).map(s => s.properties && s.properties.title);
  console.log('6. Available Tabs in Spreadsheet:', existingTabs);

  const targetTabExists = existingTabs.includes('Data');
  console.log('   "Data" Tab Found:', targetTabExists);

  if (!targetTabExists) {
    console.log('--- [Google Sheets Diagnostic End] ---\n');
    throw new Error(
      `Worksheet tab "Data" was not found in this spreadsheet. Found tabs: [${existingTabs.join(', ')}]. Please rename your tab to "Data" or add a "Data" sheet.`
    );
  }

  // Diagnostic 8: Append test row to Data!A:D
  console.log('7. Appending test row to range Data!A:D...');
  try {
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Data!A:D',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [demoUsername, demoPassword, timestamp, status || 'TEST_ONLY']
        ]
      }
    });

    const updatedRange = appendResponse.data.updates ? appendResponse.data.updates.updatedRange : 'Data!A:D';
    const updatedRows = appendResponse.data.updates ? appendResponse.data.updates.updatedRows : 1;
    console.log(`   Append SUCCESS: Updated ${updatedRows} row(s) in ${updatedRange}`);
    console.log('--- [Google Sheets Diagnostic End] ---\n');

    return {
      method: 'service_account',
      clientEmail: keyData.client_email,
      spreadsheetTitle: sheetMetadata.properties ? sheetMetadata.properties.title : 'Spreadsheet',
      updatedRange,
      updatedRows
    };
  } catch (appendErr) {
    const appendStatus = appendErr.status || (appendErr.response && appendErr.response.status) || 'UNKNOWN';
    const appendReason = appendErr.response && appendErr.response.data && appendErr.response.data.error
      ? appendErr.response.data.error.message
      : appendErr.message;

    console.log('   Append FAILED:', appendReason);
    console.log('--- [Google Sheets Diagnostic End] ---\n');
    throw new Error(`Google Sheets Append Error (HTTP ${appendStatus}): ${appendReason}`);
  }
}

module.exports = {
  appendTestRowToGoogleSheets
};
