const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
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

// Merge cookie strings, with later values overwriting earlier ones for the same name.
function mergeCookies(existing, fresh) {
  if (!fresh) return existing;
  const jar = new Map();
  for (const pair of `${existing}; ${fresh}`.split(/;\s*/)) {
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
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

// Follow a redirect chain manually, accumulating cookies at each hop.
// Returns { text, finalUrl, allCookies } after the chain resolves to a 200 (or maxHops).
async function followRedirects(startUrl, initCookies, maxHops = 8) {
  let url = startUrl;
  let allCookies = initCookies;
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { Cookie: allCookies, "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
    });
    const hopCookies = parseCookies(res.headers.getSetCookie());
    if (hopCookies) allCookies = mergeCookies(allCookies, hopCookies);
    const loc = res.headers.get("location") || "";
    console.log(`  redirect hop${hop + 1}: ${res.status} ${url.split("?")[0]} → ${loc.split("?")[0]} cookies+=${res.headers.getSetCookie().length}`);
    if (res.status === 200) {
      const text = await res.text();
      return { text, finalUrl: res.url || url, allCookies };
    }
    if (res.status < 300 || res.status >= 400 || !loc) {
      // Non-redirect, non-200 — surface it
      const text = await res.text();
      return { text, finalUrl: url, allCookies };
    }
    url = loc.startsWith("http") ? loc : `${BASE}${loc}`;
  }
  return { text: "", finalUrl: url, allCookies };
}

async function bswAuth(username, password) {
  const corrId = randomUUID();
  const reqId  = randomUUID();
  const sessId = randomUUID();

  // ── Step 1: OAuth token ──────────────────────────────────────────────────────
  const tokenRes = await fetch("https://sso.bswhealth.com/OAuth/Token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      Origin: BASE,
      Referer: `${BASE}/login`,
      "x-bsw-language": "en",
      "x-bsw-timezone-offset": "300",
      "bsw-CorrelationId": corrId,
      "bsw-RequestId": reqId,
      "bsw-SessionId": sessId,
    },
    body: JSON.stringify({ username, password, grant_type: "password", uniqueDeviceId: DEVICE_ID }),
  });
  if (!tokenRes.ok) throw new HttpsError("unavailable", `BSW OAuth failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  const { access_token } = tokenData;
  if (!access_token) throw new HttpsError("unavailable", "BSW OAuth: no access_token");
  let allCookies = parseCookies(tokenRes.headers.getSetCookie());
  console.log(`bswAuth step1 OK: cookieLen=${allCookies.length}`);

  // ── Step 2: init/fromToken — follow ALL redirect hops manually ────────────────
  // Native fetch's redirect:'follow' only surfaces Set-Cookie from the FINAL response;
  // intermediate redirect hops that set cookies are silently dropped. We use
  // redirect:'manual' and follow the chain ourselves to capture every Set-Cookie.
  const initRes = await fetch("https://aspen-api-prod.bswapi.com/api/v1/init/fromToken", {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      Origin: BASE,
      Referer: `${BASE}/login`,
      "x-environment": "prod",
      "x-health-system": "baylor",
      "bsw-correlationid": corrId,
      "bsw-requestid": reqId,
      "bsw-sessionid": sessId,
    },
    body: JSON.stringify({ token: access_token }),
  });
  const initSetCookies = initRes.headers.getSetCookie();
  const initBodyText   = await initRes.text();
  const initLocation   = initRes.headers.get("location") || "";
  console.log(`bswAuth step2: status=${initRes.status} setCookies=${initSetCookies.length} location=${initLocation.split("?")[0]} body=${initBodyText.slice(0, 300)}`);
  if (initSetCookies.length > 0) allCookies = mergeCookies(allCookies, parseCookies(initSetCookies));

  // Follow redirects from init/fromToken
  if (initLocation) {
    const startUrl = initLocation.startsWith("http") ? initLocation : `${BASE}${initLocation}`;
    const { allCookies: redirectCookies } = await followRedirects(startUrl, allCookies);
    allCookies = redirectCookies;
  } else if (initRes.status === 200) {
    // Some portal versions return JSON with a redirect URL in the body
    try {
      const parsed = JSON.parse(initBodyText);
      const redirectUrl = parsed.redirectUrl || parsed.url || parsed.redirect || "";
      if (redirectUrl) {
        console.log(`bswAuth step2: body has redirectUrl=${redirectUrl.split("?")[0]}`);
        const startUrl = redirectUrl.startsWith("http") ? redirectUrl : `${BASE}${redirectUrl}`;
        const { allCookies: redirectCookies } = await followRedirects(startUrl, allCookies);
        allCookies = redirectCookies;
      }
    } catch {}
  }

  console.log(`bswAuth step2 done: allCookiesLen=${allCookies.length}`);

  // ── Step 3: GET DT test-results page for CSRF ─────────────────────────────────
  // Capture allCookies from followRedirects — each hop may set new session cookies
  // that are required for subsequent DT API calls.
  const { text: pageHtml, finalUrl, allCookies: step3Cookies } = await followRedirects(`${BASE}/DT/app/test-results`, allCookies);
  allCookies = step3Cookies;
  console.log(`bswAuth step3: finalUrl=${finalUrl.split("?")[0]} cookiesLen=${allCookies.length} htmlLen=${pageHtml.length}`);

  if (finalUrl.includes("/reset") || finalUrl.includes("/login") || pageHtml.length < 1000) {
    console.error("bswAuth step3: not authenticated — redirected to login or got tiny page. HTML preview:", pageHtml.slice(0, 500));
    throw new HttpsError("unavailable", `BSW session not established — landed on ${finalUrl.split("?")[0]}. Check credentials and device ID.`);
  }

  let csrf = "";
  const m =
    pageHtml.match(/<input[^>]*name="__RequestVerificationToken"[^>]*value="([^"]+)"/i) ||
    pageHtml.match(/<input[^>]*value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
  if (m) csrf = m[1];
  if (!csrf) console.warn("bswSync: CSRF token not found — requests may fail");

  return { cookies: allCookies, csrf };
}

// ── DT API wrapper ────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function dtPost(cookies, csrf, path, body, referer = `${BASE}/DT/app/test-results`) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type":               "application/json",
      Accept:                       "application/json",
      Origin:                       BASE,
      Referer:                      referer,
      Cookie:                       cookies,
      "User-Agent":                 UA,
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

// ── Claude prompts ────────────────────────────────────────────────────────────

// Identical to handleReprocessLabs in HospitalView.jsx
const LAB_EXTRACT_SYSTEM = `Extract quantitative lab panels from this clinical note.
Output only this line (or nothing if no quantitative labs are present):
LAB_PANELS: [{"testName":"CBC Panel","date":"YYYY-MM-DD","labValues":[{"name":"HGB","value":7.1,"unit":"g/dL","refLow":12,"refHigh":17,"flag":"L"},...]}]
Use flag values: "N"=normal, "H"=high, "L"=low, "C"=critical. Only numeric values with known reference ranges.`;

// ── (original AddDocumentModal.jsx prompts below) ─────────────────────────────

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
    let cookies, csrf;
    try {
      ({ cookies, csrf } = await bswAuth(bswUsername.value(), bswPassword.value()));
    } catch (err) {
      throw err instanceof HttpsError ? err : new HttpsError("unavailable", `BSW auth failed: ${err.message}`);
    }

    // 2. Fetch notes then results sequentially — BSW session rejects concurrent CSRF usage
    let rawNotes, rawResults;
    try {
      rawNotes   = await fetchVisitNotes(cookies, csrf);
      rawResults = await fetchTestResults(cookies, csrf);
    } catch (err) {
      throw new HttpsError("unavailable", `BSW data fetch failed: ${err.message}`);
    }

    // 3. Load existing stay for deduplication
    const stayRef  = db.collection("hospitalStays").doc(stayId);
    const staySnap = await stayRef.get();
    if (!staySnap.exists) throw new HttpsError("not-found", `Hospital stay ${stayId} not found.`);
    const stayData = staySnap.data();

    // Dedup by stable IDs (hnoID / groupKey) with date|name fallback for old entries.
    const existingNoteHnoIds = new Set(
      (stayData.doctorNotes || []).filter((n) => n.bswImported && n.hnoID).map((n) => n.hnoID),
    );
    const existingNoteDateAuthors = new Set(
      (stayData.doctorNotes || []).filter((n) => n.bswImported).map((n) => `${n.date}|${(n.author || "").toLowerCase()}`),
    );
    const existingResultGroupKeys = new Set(
      (stayData.testResults || []).filter((r) => r.bswImported && r.groupKey).map((r) => r.groupKey),
    );
    const existingResultDateNames = new Set(
      (stayData.testResults || []).filter((r) => r.bswImported).map((r) => `${r.date}|${(r.testName || "").toLowerCase()}`),
    );

    // 4. Interpret notes with Claude
    const newNoteEntries = [];
    for (const raw of rawNotes) {
      if (existingNoteHnoIds.has(raw.hnoID) || existingNoteDateAuthors.has(`${raw.date}|${raw.author.toLowerCase()}`)) continue;

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
        hnoID:         raw.hnoID,
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
      if (existingResultGroupKeys.has(raw.groupKey)) continue;

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

      // Also skip if a prior run wrote this result under a different groupKey (using date|name)
      if (existingResultDateNames.has(`${date}|${testName.toLowerCase()}`)) continue;

      newResultEntries.push({
        id:            newId(),
        groupKey:      raw.groupKey,
        date,
        testName,
        extractedText: raw.extractedText,
        interpretation,
        labValues,
        uploadedAt:    new Date().toISOString(),
        bswImported:   true,
      });
    }

    // 5.5 — Extract embedded lab panels from new notes, add as additional test results
    // Unified dedup set covers both BSW-synced results and existing ones
    const allResultDateNames = new Set([
      ...existingResultDateNames,
      ...newResultEntries.map((r) => `${r.date}|${r.testName.toLowerCase()}`),
    ]);
    let labsExtracted = 0;
    for (const noteEntry of newNoteEntries) {
      if (!noteEntry.extractedText || noteEntry.extractedText.length < 50) continue;
      try {
        const resp = await client.messages.create({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system:     LAB_EXTRACT_SYSTEM,
          messages:   [{ role: "user", content: noteEntry.extractedText.slice(0, 8000) }],
        });
        let labPanels = [];
        for (const line of resp.content[0].text.split("\n")) {
          if (line.startsWith("LAB_PANELS:")) {
            try { labPanels = JSON.parse(line.replace("LAB_PANELS:", "").trim()); } catch {}
          }
        }
        for (const panel of labPanels) {
          if (!panel.testName || !panel.labValues?.length) continue;
          const panelDate = panel.date || noteEntry.date;
          const dedupKey  = `${panelDate}|${panel.testName.toLowerCase()}`;
          if (allResultDateNames.has(dedupKey)) continue;
          allResultDateNames.add(dedupKey);
          newResultEntries.push({
            id:            newId(),
            date:          panelDate,
            testName:      panel.testName,
            labValues:     panel.labValues,
            interpretation: `Lab values extracted from ${noteEntry.noteType || "doctor note"}${noteEntry.author ? ` by ${noteEntry.author}` : ""}`,
            extractedText: "",
            uploadedAt:    new Date().toISOString(),
            bswImported:   true,
          });
          labsExtracted++;
        }
      } catch (err) {
        console.warn(`bswSync: lab extract failed for note ${noteEntry.hnoID}:`, err.message);
      }
    }
    if (labsExtracted > 0) console.log(`bswSync: extracted ${labsExtracted} lab panel(s) from notes`);

    // 6. Write to Firestore in one update
    if (newNoteEntries.length > 0 || newResultEntries.length > 0) {
      const updatePayload = { updatedAt: new Date().toISOString() };
      if (newNoteEntries.length > 0)   updatePayload.doctorNotes  = FieldValue.arrayUnion(...newNoteEntries);
      if (newResultEntries.length > 0) updatePayload.testResults  = FieldValue.arrayUnion(...newResultEntries);
      await stayRef.update(updatePayload);
    }

    console.log(`bswSync: stayId=${stayId} notesAdded=${newNoteEntries.length} resultsAdded=${newResultEntries.length} labsExtracted=${labsExtracted}`);
    return { notesAdded: newNoteEntries.length, resultsAdded: newResultEntries.length };
  },
);

// Full sync test trigger — no Firebase auth required, stayId hardcoded.
// DELETE after sync is confirmed working.
exports.testBswSync = onRequest(
  { secrets: [bswUsername, bswPassword, anthropicKey], timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    const stayId = "mow8y2hrxqt55x04hq";
    try {
      const db = getFirestore();
      const client = new Anthropic({ apiKey: anthropicKey.value() });

      const { cookies, csrf } = await bswAuth(bswUsername.value(), bswPassword.value());
      console.log("testBswSync: auth OK, csrf length:", csrf.length);

      const rawNotes = await fetchVisitNotes(cookies, csrf);
      console.log("testBswSync: visit notes fetched:", rawNotes.length);

      const rawResults = await fetchTestResults(cookies, csrf);
      console.log("testBswSync: test results fetched:", rawResults.length);

      const stayRef  = db.collection("hospitalStays").doc(stayId);
      const staySnap = await stayRef.get();
      if (!staySnap.exists) return res.status(404).json({ error: "stay not found" });
      let stayData = staySnap.data();

      // ?reset=true — wipe all bswImported entries so re-import starts fresh
      if (req.query.reset === "true") {
        const cleanNotes   = (stayData.doctorNotes  || []).filter((n) => !n.bswImported);
        const cleanResults = (stayData.testResults  || []).filter((r) => !r.bswImported);
        await stayRef.update({ doctorNotes: cleanNotes, testResults: cleanResults, updatedAt: new Date().toISOString() });
        const freshSnap = await stayRef.get();
        stayData = freshSnap.data();
        console.log("testBswSync: reset — cleared old bswImported entries");
      }

      const existingNoteHnoIds = new Set(
        (stayData.doctorNotes || []).filter((n) => n.bswImported && n.hnoID).map((n) => n.hnoID),
      );
      const existingNoteDateAuthors = new Set(
        (stayData.doctorNotes || []).filter((n) => n.bswImported).map((n) => `${n.date}|${(n.author || "").toLowerCase()}`),
      );
      const existingResultGroupKeys = new Set(
        (stayData.testResults || []).filter((r) => r.bswImported && r.groupKey).map((r) => r.groupKey),
      );
      const existingResultDateNames = new Set(
        (stayData.testResults || []).filter((r) => r.bswImported).map((r) => `${r.date}|${(r.testName || "").toLowerCase()}`),
      );

      const newNoteEntries = [];
      for (const raw of rawNotes) {
        if (existingNoteHnoIds.has(raw.hnoID) || existingNoteDateAuthors.has(`${raw.date}|${raw.author.toLowerCase()}`)) continue;
        let author = raw.author, date = raw.date, interpretation = "";
        if (raw.extractedText.length > 20) {
          try {
            const resp = await client.messages.create({
              model: "claude-haiku-4-5-20251001", max_tokens: 1024,
              system: NOTE_SYSTEM, messages: [{ role: "user", content: raw.extractedText.slice(0, 8000) }],
            });
            ({ author, date, interpretation } = parseNoteResponse(resp.content[0].text, raw));
          } catch (err) { console.warn("Claude note error:", err.message); }
        }
        newNoteEntries.push({ id: newId(), hnoID: raw.hnoID, date, author, noteType: raw.noteType, extractedText: raw.extractedText, interpretation, pdfUrl: "", storagePath: "", fileName: `${raw.noteType} - ${author} - ${date}`, uploadedAt: new Date().toISOString(), bswImported: true });
      }

      const newResultEntries = [];
      for (const raw of rawResults) {
        if (existingResultGroupKeys.has(raw.groupKey)) continue;
        let testName = `BSW Result ${raw.formattedDate}`, date = raw.date, labValues = [], interpretation = "";
        if (raw.extractedText.length > 20) {
          try {
            const resp = await client.messages.create({
              model: "claude-haiku-4-5-20251001", max_tokens: 1024,
              system: RESULT_SYSTEM, messages: [{ role: "user", content: raw.extractedText.slice(0, 8000) }],
            });
            ({ testName, date, labValues, interpretation } = parseResultResponse(resp.content[0].text, raw));
          } catch (err) { console.warn("Claude result error:", err.message); }
        }
        if (existingResultDateNames.has(`${date}|${testName.toLowerCase()}`)) continue;
        newResultEntries.push({ id: newId(), groupKey: raw.groupKey, date, testName, extractedText: raw.extractedText, interpretation, labValues, uploadedAt: new Date().toISOString(), bswImported: true });
      }

      // Extract embedded lab panels from new notes
      const allResultDateNames = new Set([
        ...existingResultDateNames,
        ...newResultEntries.map((r) => `${r.date}|${r.testName.toLowerCase()}`),
      ]);
      let labsExtracted = 0;
      for (const noteEntry of newNoteEntries) {
        if (!noteEntry.extractedText || noteEntry.extractedText.length < 50) continue;
        try {
          const resp = await client.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 1024,
            system: LAB_EXTRACT_SYSTEM, messages: [{ role: "user", content: noteEntry.extractedText.slice(0, 8000) }],
          });
          let labPanels = [];
          for (const line of resp.content[0].text.split("\n")) {
            if (line.startsWith("LAB_PANELS:")) {
              try { labPanels = JSON.parse(line.replace("LAB_PANELS:", "").trim()); } catch {}
            }
          }
          for (const panel of labPanels) {
            if (!panel.testName || !panel.labValues?.length) continue;
            const panelDate = panel.date || noteEntry.date;
            const dedupKey = `${panelDate}|${panel.testName.toLowerCase()}`;
            if (allResultDateNames.has(dedupKey)) continue;
            allResultDateNames.add(dedupKey);
            newResultEntries.push({ id: newId(), date: panelDate, testName: panel.testName, labValues: panel.labValues, interpretation: `Lab values extracted from ${noteEntry.noteType || "doctor note"}${noteEntry.author ? ` by ${noteEntry.author}` : ""}`, extractedText: "", uploadedAt: new Date().toISOString(), bswImported: true });
            labsExtracted++;
          }
        } catch (err) { console.warn("Lab extract error:", err.message); }
      }

      if (newNoteEntries.length > 0 || newResultEntries.length > 0) {
        const updatePayload = { updatedAt: new Date().toISOString() };
        if (newNoteEntries.length > 0)   updatePayload.doctorNotes  = FieldValue.arrayUnion(...newNoteEntries);
        if (newResultEntries.length > 0) updatePayload.testResults  = FieldValue.arrayUnion(...newResultEntries);
        await stayRef.update(updatePayload);
      }

      res.json({ ok: true, notesAdded: newNoteEntries.length, resultsAdded: newResultEntries.length, labsExtracted });
    } catch (err) {
      console.error("testBswSync error:", err.message, err.stack);
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// Connectivity test — hit BSW OAuth step only, no Firestore writes, no data fetch.
// DELETE after confirming connectivity.
exports.testBswConn = onRequest(
  { secrets: [bswUsername, bswPassword] },
  async (req, res) => {
    const corrId = randomUUID();
    try {
      const tokenRes = await fetch("https://sso.bswhealth.com/OAuth/Token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://my.bswhealth.com",
          "x-bsw-language": "en",
          "x-bsw-timezone-offset": "300",
          "bsw-CorrelationId": corrId,
          "bsw-RequestId": randomUUID(),
          "bsw-SessionId": randomUUID(),
        },
        body: JSON.stringify({
          username: bswUsername.value(),
          password: bswPassword.value(),
          grant_type: "password",
          uniqueDeviceId: DEVICE_ID,
        }),
      });
      const body = await tokenRes.json();
      if (body.access_token) {
        res.json({ ok: true, step: "oauth", tokenLength: body.access_token.length });
      } else {
        res.status(401).json({ ok: false, step: "oauth", response: body });
      }
    } catch (err) {
      res.status(500).json({ ok: false, step: "oauth", error: err.message });
    }
  },
);
