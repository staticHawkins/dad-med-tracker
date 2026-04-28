const { initializeApp, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

if (getApps().length === 0) initializeApp()
const db = getFirestore()

async function run() {
  const snap = await db.collection('users').get()
  for (const userDoc of snap.docs) {
    const data = userDoc.data()
    const tokens = data.fcmTokens || []
    const hasLegacy = tokens.some(t => typeof t === 'string')
    if (!hasLegacy) {
      console.log(`${userDoc.id}: no legacy strings, skipping`)
      continue
    }
    const cleaned = tokens.filter(t => typeof t !== 'string')
    await userDoc.ref.update({ fcmTokens: cleaned })
    console.log(`${userDoc.id}: removed ${tokens.length - cleaned.length} legacy string(s), kept ${cleaned.length} object(s)`)
  }
  console.log('done')
}

run().catch(console.error)
