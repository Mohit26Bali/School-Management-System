// Signing someone out everywhere. Sessions are files in .sessions/ (one per browser), named <session id>.json.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", ".sessions");

// Deletes every session that belongs to this user, except the one named in keepSessionId (the browser they are using now).
function destroySessionsFor(userId, keepSessionId) {
  let files = [];
  try {
    files = fs.readdirSync(DIR);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of files) {
    if (!name.endsWith(".json")) continue;
    if (keepSessionId && name === `${keepSessionId}.json`) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
      if (data.userId === userId) {
        fs.unlinkSync(path.join(DIR, name));
        removed += 1;
      }
    } catch {
      /* unreadable or already gone */
    }
  }
  return removed;
}

module.exports = { destroySessionsFor };
