const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const Anthropic = require("@anthropic-ai/sdk");
const { supplyStatus } = require("./lib/medSupplyUtils");

if (getApps().length === 0) initializeApp();

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

// Update this URL once the Vercel project is created
const APP_URL = "https://family-care-hub-rho.vercel.app";

exports.askClaude = onCall({ secrets: [anthropicKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in to use Ask AI.");
  }

  const { messages, systemContext } = request.data;

  if (!Array.isArray(messages) || !systemContext) {
    throw new HttpsError("invalid-argument", "messages and systemContext are required.");
  }

  const client = new Anthropic({ apiKey: anthropicKey.value() });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemContext,
    messages,
  });

  return { content: response.content[0].text };
});

exports.checkMedSupply = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "America/Chicago",
    region: "us-central1",
  },
  async (_event) => {
    const db = getFirestore();
    const messaging = getMessaging();

    const [medsSnap, usersSnap] = await Promise.all([
      db.collection("medications").get(),
      db.collection("users").get(),
    ]);

    const meds = medsSnap.docs.map((d) => d.data());
    const urgentMeds = meds.filter((m) => supplyStatus(m) === "urgent");
    const soonMeds   = meds.filter((m) => supplyStatus(m) === "soon");

    let title, body;
    if (urgentMeds.length === 0 && soonMeds.length === 0) {
      title = "All meds are stocked";
      body  = "No refills needed today.";
    } else {
      const parts = [];
      if (urgentMeds.length > 0) parts.push(`Urgent refill needed: ${urgentMeds.map((m) => m.name).join(", ")}`);
      if (soonMeds.length > 0)   parts.push(`Refill soon: ${soonMeds.map((m) => m.name).join(", ")}`);
      body  = parts.join(" · ");
      title = urgentMeds.length > 0
        ? `⚠ ${urgentMeds.length} med${urgentMeds.length > 1 ? "s" : ""} need urgent refill`
        : `${soonMeds.length} med${soonMeds.length > 1 ? "s need" : " needs"} refill soon`;
    }

    // Collect all tokens across all users, handling both legacy strings and object entries
    const tokenEntries = []; // { token, entry, userDoc }
    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const raw = Array.isArray(data.fcmTokens) ? data.fcmTokens : (data.fcmToken ? [data.fcmToken] : []);
      for (const entry of raw) {
        const token = typeof entry === 'string' ? entry : entry?.token;
        if (token) tokenEntries.push({ token, entry, userDoc });
      }
    }

    if (tokenEntries.length === 0) {
      console.log("checkMedSupply: no FCM tokens registered");
      return;
    }

    const tokens = tokenEntries.map((e) => e.token);
    const response = await messaging.sendEachForMulticast({
      tokens,
      data: { title, body },
      webpush: {
        fcmOptions: { link: APP_URL },
      },
    });

    // Remove stale tokens from Firestore
    const staleEntries = tokenEntries.filter((_, idx) => {
      const resp = response.responses[idx];
      return !resp.success && (
        resp.error?.code === "messaging/registration-token-not-registered" ||
        resp.error?.code === "messaging/invalid-registration-token"
      );
    });

    if (staleEntries.length > 0) {
      const staleTokens = new Set(staleEntries.map((e) => e.token));
      // Group stale removals by user doc to do one write per user
      const byUser = new Map();
      for (const e of staleEntries) {
        if (!byUser.has(e.userDoc.id)) byUser.set(e.userDoc.id, e.userDoc);
      }
      await Promise.all(
        [...byUser.values()].map((userDoc) => {
          const data = userDoc.data();
          const raw = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
          const kept = raw.filter((entry) => {
            const t = typeof entry === 'string' ? entry : entry?.token;
            return !staleTokens.has(t);
          });
          return userDoc.ref.update({ fcmTokens: kept });
        })
      );
      console.log(`checkMedSupply: removed ${staleEntries.length} stale token(s)`);
    }

    console.log(
      `checkMedSupply: sent to ${response.successCount}/${tokens.length} token(s) across ${usersSnap.size} user(s). ` +
      `Urgent: ${urgentMeds.length}, Soon: ${soonMeds.length}, OK: ${meds.length - urgentMeds.length - soonMeds.length}`
    );
  }
);
