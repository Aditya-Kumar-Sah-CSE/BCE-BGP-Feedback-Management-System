/**
 * BCE FACULTY FEEDBACK PORTAL — GOOGLE APPS SCRIPT CONNECTOR
 * 
 * Purpose: Provides native Form → Sheet destination linking.
 * FormApp.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId)
 * 
 * Deployment:
 * 1. Create a new Apps Script project at https://script.google.com
 * 2. Paste this code into Code.gs
 * 3. Deploy > New Deployment > Web app:
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone (or restricted with secret token)
 * 4. Copy the Web App URL and add to your .env.local:
 *    GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
 *    GOOGLE_APPS_SCRIPT_SECRET="your-chosen-secret"
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10s timeout
    
    var data;
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = {};
    }
    
    // Optional secret check
    var scriptSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (scriptSecret && data.secret !== scriptSecret) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Invalid or missing secret' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var action = data.action;
    var formId = data.formId;
    var sheetId = data.sheetId;

    if (action === 'linkFormToSheet' || !action) {
      if (!formId || !sheetId) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: 'formId and sheetId are required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      
      var result = linkFormToSheet(formId, sheetId);
      return ContentService.createTextOutput(
        JSON.stringify(result)
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Unknown action: ' + action })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'BCE Faculty Feedback Portal Apps Script Connector',
      version: '1.0.0'
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Links a Google Form directly to a Google Spreadsheet natively.
 * Responses will automatically populate as new rows in this spreadsheet.
 */
function linkFormToSheet(formId, sheetId) {
  var form = FormApp.openById(formId);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);
  
  return {
    success: true,
    formId: formId,
    sheetId: sheetId,
    destinationType: 'NATIVE_SHEET',
    message: 'Google Form response destination successfully connected to Google Sheet.'
  };
}
