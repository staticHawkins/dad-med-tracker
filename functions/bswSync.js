const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const { randomUUID } = require("crypto");

const bswUsername = defineSecret("BSW_USERNAME");
const bswPassword = defineSecret("BSW_PASSWORD");
const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

const BASE = "https://my.bswhealth.com";
const DEVICE_ID = "0f374a02-a80b-4587-8dcc-582aa9f7f9a5"; // remembered device — bypasses 2FA

// ── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseCookies(rawArray) {
  // rawArray comes from response.headers.getSetCookie() — each element is a full
  // Set-Cookie header value; we only need the Name=Value part before the first ';'
  return (rawArray || []).map((h) => h.split(";")[0]).join("; ");
}

function stripHtml(raw) {
  return (raw || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#47;/g, "/")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── BSW auth ─────────────────────────────────────────────────────────────────

async function bswAuth(username, password) {
  const corrId = randomUUID();
  const reqId  = randomUUID();
  const sessId = randomUUID();
  const bswHdrs = {
    Accept:                "application/json",
    "Content-Type":        "application/json",
    Origin:                BASE,
    Referer:               `${BASE}/login`,
    "x-bsw-language":     "en",
    "x-bsw-timezone-offset": "300",
    "bsw-CorrelationId":  corrId,
    "bsw-RequestId":      reqId,
    "bsw-SessionId":      sessId,
  };

  // Step 1 — OAuth token
  const tokenRes = await fetch("https://sso.bswhealth.com/OAuth/Token", {
    method: "POST",
    headers: bswHdrs,
    body: JSON.stringify({ username, password, grant_type: "password", uniqueDeviceId: DEVICE_ID }),
  });
  if (!tokenRes.ok) throw new HttpsError("unavailable", `BSW auth step 1 failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new HttpsError("unavailable", "BSW auth step 1: no access_token in response");

  // Step 2 — initialize MyChart session, capture cookies
  const initRes = await fetch("https://aspen-api-prod.bswapi.com/api/v1/init/fromToken", {
    method: "POST",
    headers: {
      ...bswHdrs,
      "x-environment":   "prod",
      "x-health-system": "baylor",
      "bsw-correlationid": corrId,
      "bsw-requestid":     reqId,
      "bsw-sessionid":     sessId,
    },
    body: JSON.stringify({ token: access_token }),
  });
  if (!initRes.ok) throw new HttpsError("unavailable", `BSW auth step 2 failed: ${initRes.status}`);
  const cookies = parseCookies(initRes.headers.getSetCookie());

  // Step 3 — load DT page to harvest CSRF token
  const pageRes = await fetch(`${BASE}/DT/app/test-results`, {
    headers: { Cookie: cookies, Accept: "text/html" },
  });
  if (!pageRes.ok) throw new HttpsError("unavailable", `BSW auth step 3 failed: ${pageRes.status}`);
  const html = await pageRes.text();

  let csrf = "";
  const m =
    html.match(/<input[^>]*name="__RequestVerificationToken"[^>]*value="([^"]+)"/i) ||
    html.match(/<input[^>]*value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
  if (m) csrf = m[1];
  if (!csrf) console.warn("bswSync: CSRF token not found in page HTML — requests may fail");

  return { cookies, csrf };
}

// ── DT API wrapper ────────────────────────────────────────────────────────────

async function dtPost(cookies, csrf, path, body, referer = `${BASE}/DT/app/test-results`) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type":              "application/json",
      Accept:                      "application/json",
      Origin:                      BASE,
      Referer:                     referer,
      Cookie:                      cookies,
      "__requestverificationtoken": csrf,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DT API ${path} returned HTTP ${res.status}`);
  return res.json();
}

// ── Visit notes ───────────────────────────────────────────────────────────────

async function fetchVisitNotes(cookies, csrf) {
  const bedside = await dtPost(cookies, csrf, "/DT/api/bedside/GetBedsideInfo", {});
  const csn = bedside.contactSerialNumber;
  if (!csn) {
    console.warn("bswSync: no CSN from bedside — skipping visit notes");
    return [];
  }

  const data = await dtPost(
    cookies, csrf,
    "/DT/api/visit-notes/GetVisitNotes",
    { CSN: csn, FromPvdPage: false },
    `${BASE}/DT/app/visit-notes`,
  );
  const lrpID    = data.lrpID || "";
  const noteList = data.noteList || [];

  const notes = [];
  for (const note of noteList) {
    try {
      const content = await dtPost(
        cookies, csrf,
        "/DT/api/report-content/LoadReportContent",
        {
          reportID:         lrpID,
          contextID:        note.hnoID,
          contextDAT:       note.hnoDAT,
          contextINI:       "HNO",
          csn,
          isFullReportPage: false,
          nonce:            "",
          uniqueClass:      "EID-1b",
        },
        `${BASE}/DT/app/visit-notes/note`,
      );
      const text = stripHtml(content.reportContent || "");
      notes.push({
        hnoID:         note.hnoID,
        date:          note.iso ? note.iso.slice(0, 10) : new Date().toISOString().slice(0, 10),
        author:        note.provider?.name || "",
        noteType:      note.displayName   || "Progress Notes",
        extractedText: text,
      });
    } catch (err) {
      console.warn(`bswSync: failed to load note ${note.hnoID}:`, err.message);
    }
  }
  return notes;
}

// ── Test results ──────────────────────────────────────────────────────────────

async function fetchTestResults(cookies, csrf) {
  const listData = await dtPost(cookies, csrf, "/DT/api/test-results/GetList", {
    groupType:              "UNINITIALIZED",
    searchString:           "",
    maxResults:             0,
    isCurAdmFilterEnabled:  false,
  });

  const groups  = listData.newResultGroups || [];
  const results = [];

  for (const group of groups) {
    try {
      const detail = await dtPost(cookies, csrf, "/DT/api/test-results/GetDetails", {
        orderKey:       group.key,
        organizationID: group.organizationID,
        PageNonce:      "",
      });

      let extractedText = "";
      if (typeof detail === "string") {
        extractedText = stripHtml(detail);
      } else if (detail.reportContent) {
        extractedText = stripHtml(detail.reportContent);
      } else if (detail.resultText) {
        extractedText = detail.resultText;
      } else {
        extractedText = JSON.stringify(detail);
      }

      results.push({
        date:              group.sortDate ? group.sortDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        groupKey:          group.key,
        organizationID:    group.organizationID,
        formattedDate:     group.formattedDate || "",
        isInpatient:       group.isInpatient || false,
        isCurrentAdmission: group.isCurrentAdmission || false,
        extractedText,
      });
    } catch (err) {
      console.warn(`bswSync: failed to load test group ${group.key}:`, err.message);
    }
  }
  return results;
}

// ── Claude prompts (exact copy from AddDocumentModal.jsx) ─────────────────────

const NOTE_SYSTEM = `You are helping a family understand their father's clinical notes from his hospital care team.

First, extract the following metadata from the note and output each on its own line at the very top:
AUTHOR: <provider name from signature, "Attending:", "Provider:", "Signed by:", or "Dictated by:" — if not found, omit this line>
ROLE: <their role or specialty in 3-5 words max, e.g., Attending Nephrologist, Resident, Oncologist — if not found, omit this line>
DATE: <service or note date in YYYY-MM-DD format — look for "Service date:", "Signed", or a date in the header — if not found, omit this line>

Then on a new line, translate the note into plain English. Focus on: what the doctor observed or assessed, any key decisions made, current treatment status, and what to expect next. Write 3-5 clear bullet points, each starting with a dash (-). No markdown headers, no bold text, no medical jargon.`;

const RESULT_SYSTEM = `You are helping a family understand medical test results for their father.

First, output the following metadata on their own lines:
TEST_NAME: <name of the test or report, e.g., CBC Panel, CT Chest — if not found, use the file title>
DATE: <result date in YYYY-MM-DD format — if not found, omit>

If this is a quantitative lab report (CBC, BMP, CMP, metabolic panel, liver function, renal function, lipid panel, thyroid, coagulation, urinalysis), also output exactly one line:
LAB_VALUES: [{"name":"HGB","value":7.1,"unit":"g/dL","refLow":12,"refHigh":17,"flag":"L"},...]
Use flag values: "N" = normal, "H" = high, "L" = low, "C" = critical. Only include numeric values with known reference ranges. If not a quantitative lab, omit this line entirely.

Then explain the key findings in plain English. Write 3-5 clear bullet points, each starting with a dash (-). Flag anything outside normal range and explain what it means. No markdown headers, no bold text, no medical jargon.`;

// Parses Claude response for a note — mirrors AddDocumentModal.jsx:87-104
function parseNoteResponse(text, rawNote) {
  const lines = text.split("\n");
  let rest = lines;
  let author = rawNote.author;
  let date   = rawNote.date;
  const metaKeys = ["AUTHOR:", "ROLE:", "DATE:"];
  while (rest.length > 0 && metaKeys.some((k) => rest[0]?.startsWith(k))) {
    const line = rest[0];
    if (line.startsWith("AUTHOR:")) {
      const val = line.replace("AUTHOR:", "").trim();
      if (val) author = val;
    } else if (line.startsWith("DATE:")) {
      const val = line.replace("DATE:", "").trim();
      if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) date = val;
    }
    rest = rest.slice(1);
  }
  return { author, date, interpretation: rest.join("\n").trimStart() };
}

// Parses Claude response for a test result — mirrors AddDocumentModal.jsx:106-122
function parseResultResponse(text, rawResult) {
  const lines = text.split("\n");
  const testMetaKeys = ["TEST_NAME:", "DATE:", "LAB_VALUES:"];
  const contentLines = [];
  let testName  = `BSW Result ${rawResult.formattedDate}`;
  let date      = rawResult.date;
  let labValues = [];
  for (const line of lines) {
    if (line.startsWith("TEST_NAME:")) {
      const val = line.replace("TEST_NAME:", "").trim();
      if (val) testName = val;
    } else if (line.startsWith("DATE:")) {
      const val = line.replace("DATE:", "").trim();
      if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) date = val;
    } else if (line.startsWith("LAB_VALUES:")) {
      try { labValues = JSON.parse(line.replace("LAB_VALUES:", "").trim()); } catch {}
    } else if (!testMetaKeys.some((k) => line.startsWith(k))) {
      contentLines.push(line);
    }
  }
  return {
    testName,
    date,
    labValues,
    interpretation: contentLines.join("\n").replace(/^[\s\-*_]+\n/, "").trimStart(),
  };
}

// ── Main callable ─────────────────────────────────────────────────────────────

exports.syncBswData = onCall(
  {
    secrets:        [bswUsername, bswPassword, anthropicKey],
    timeoutSeconds: 540,
    memory:         "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to sync BSW data.");
    }
    const { stayId } = request.data;
    if (!stayId || typeof stayId !== "string") {
      throw new HttpsError("invalid-argument", "stayId is required.");
    }

    const db     = getFirestore();
    const client = new Anthropic({ apiKey: anthropicKey.value() });

    // 1. Auth
    const { cookies, csrf } = await bswAuth(bswUsername.value(), bswPassword.value());

    // 2. Fetch notes + results in parallel
    const [rawNotes, rawResults] = await Promise.all([
      fetchVisitNotes(cookies, csrf),
      fetchTestResults(cookies, csrf),
    ]);

    // 3. Load existing stay for deduplication
    const stayRef  = db.collection("hospitalStays").doc(stayId);
    const staySnap = await stayRef.get();
    if (!staySnap.exists) throw new HttpsError("not-found", `Hospital stay ${stayId} not found.`);
    const stayData = staySnap.data();

    const existingNoteKeys = new Set(
      (stayData.doctorNotes || [])
        .filter((n) => n.bswImported)
        .map((n) => `${n.date}|${(n.author || "").toLowerCase()}`),
    );
    const existingResultKeys = new Set(
      (stayData.testResults || [])
        .filter((r) => r.bswImported)
        .map((r) => `${r.date}|${(r.testName || "").toLowerCase()}`),
    );

    // 4. Interpret notes with Claude
    const newNoteEntries = [];
    for (const raw of rawNotes) {
      const dedupKey = `${raw.date}|${raw.author.toLowerCase()}`;
      if (existingNoteKeys.has(dedupKey)) continue;

      let author         = raw.author;
      let date           = raw.date;
      let interpretation = "";

      if (raw.extractedText.length > 20) {
        try {
          const resp = await client.messages.create({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system:     NOTE_SYSTEM,
            messages:   [{ role: "user", content: raw.extractedText.slice(0, 8000) }],
          });
          ({ author, date, interpretation } = parseNoteResponse(resp.content[0].text, raw));
        } catch (err) {
          console.warn(`bswSync: Claude failed for note ${raw.hnoID}:`, err.message);
        }
      }

      newNoteEntries.push({
        id:            newId(),
        date,
        author,
        noteType:      raw.noteType,
        extractedText: raw.extractedText,
        interpretation,
        pdfUrl:        "",
        storagePath:   "",
        fileName:      `${raw.noteType} - ${author} - ${date}`,
        uploadedAt:    new Date().toISOString(),
        bswImported:   true,
      });
    }

    // 5. Interpret test results with Claude
    const newResultEntries = [];
    for (const raw of rawResults) {
      let testName       = `BSW Result ${raw.formattedDate}`;
      let date           = raw.date;
      let labValues      = [];
      let interpretation = "";

      if (raw.extractedText.length > 20) {
        try {
          const resp = await client.messages.create({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system:     RESULT_SYSTEM,
            messages:   [{ role: "user", content: raw.extractedText.slice(0, 8000) }],
          });
          ({ testName, date, labValues, interpretation } = parseResultResponse(resp.content[0].text, raw));
        } catch (err) {
          console.warn(`bswSync: Claude failed for result ${raw.groupKey}:`, err.message);
        }
      }

      const dedupKey = `${date}|${testName.toLowerCase()}`;
      if (existingResultKeys.has(dedupKey)) continue;

      newResultEntries.push({
        id:            newId(),
        date,
        testName,
        extractedText: raw.extractedText,
        interpretation,
        labValues,
        uploadedAt:    new Date().toISOString(),
        bswImported:   true,
      });
    }

    // 6. Write to Firestore in one update
    if (newNoteEntries.length > 0 || newResultEntries.length > 0) {
      const updatePayload = { updatedAt: new Date().toISOString() };
      if (newNoteEntries.length > 0)   updatePayload.doctorNotes  = FieldValue.arrayUnion(...newNoteEntries);
      if (newResultEntries.length > 0) updatePayload.testResults  = FieldValue.arrayUnion(...newResultEntries);
      await stayRef.update(updatePayload);
    }

    console.log(`bswSync: stayId=${stayId} notesAdded=${newNoteEntries.length} resultsAdded=${newResultEntries.length}`);
    return { notesAdded: newNoteEntries.length, resultsAdded: newResultEntries.length };
  },
);
