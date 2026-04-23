const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
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

    if (urgentMeds.length === 0 && soonMeds.length === 0) {
      console.log("checkMedSupply: all meds OK, no notifications sent");
      return;
    }

    const parts = [];
    if (urgentMeds.length > 0) parts.push(`Urgent refill needed: ${urgentMeds.map((m) => m.name).join(", ")}`);
    if (soonMeds.length > 0)   parts.push(`Refill soon: ${soonMeds.map((m) => m.name).join(", ")}`);
    const body  = parts.join(" · ");
    const title = urgentMeds.length > 0
      ? `⚠ ${urgentMeds.length} med${urgentMeds.length > 1 ? "s" : ""} need urgent refill`
      : `${soonMeds.length} med${soonMeds.length > 1 ? "s need" : " needs"} refill soon`;

    const tokens = usersSnap.docs.map((d) => d.data().fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      console.log("checkMedSupply: no FCM tokens registered");
      return;
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon: `${APP_URL}/favicon.png`,
          badge: `${APP_URL}/favicon.png`,
          tag: "med-supply-alert",
          renotify: true,
        },
        fcmOptions: { link: APP_URL },
      },
    });

    // Remove stale tokens from Firestore
    const staleUsers = usersSnap.docs.filter((d, idx) => {
      const resp = response.responses[idx];
      return !resp.success && (
        resp.error?.code === "messaging/registration-token-not-registered" ||
        resp.error?.code === "messaging/invalid-registration-token"
      );
    });

    if (staleUsers.length > 0) {
      await Promise.all(
        staleUsers.map((d) => d.ref.update({ fcmToken: null, fcmTokenUpdatedAt: null }))
      );
      console.log(`checkMedSupply: removed ${staleUsers.length} stale token(s)`);
    }

    console.log(
      `checkMedSupply: sent to ${response.successCount}/${tokens.length} token(s). ` +
      `Urgent: ${urgentMeds.length}, Soon: ${soonMeds.length}`
    );
  }
);
