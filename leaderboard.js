// Global weekly leaderboard on Firebase (anonymous sign-in + Firestore), website build.
// Loads the Firebase SDK from Google's CDN; same API as src/leaderboard.js, which the Android app bundles.
// Data: seasons/{YYYY-MM-DD of the season's Sunday}/scores/{anonymous user id}
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  let F = null;      // firestore/lite module
  let db = null;
  let uid = null;

  const scores = seasonId => F.collection(db, 'seasons', seasonId, 'scores');

  async function init(config) {
    const [appMod, authMod, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore-lite.js')]);
    F = fs;
    // Reuse the app on a retry (for example after a first attempt without internet).
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
    db = F.getFirestore(app);
    const cred = await authMod.signInAnonymously(authMod.getAuth(app));
    uid = cred.user.uid;
    return uid;
  }

  // Writes this player's season totals. Security rules only accept growing, plausible totals.
  async function submit(seasonId, d) {
    const ref = F.doc(db, 'seasons', seasonId, 'scores', uid);
    const data = {
      name: String(d.name).slice(0, 16),
      score: Math.round(d.score),
      sales: Math.round(d.sales),
      best: Number(d.best) || 0,
      fastestMin: Number(d.fastestMin) || 0,
      lang: d.lang === 'he' ? 'he' : 'en',
      updatedAt: F.serverTimestamp(),
    };
    const cur = await F.getDoc(ref);
    if (cur.exists() && cur.data().sales === data.sales && cur.data().score === data.score) {
      // Same totals: only the nickname may have changed.
      if (cur.data().name !== data.name) await F.updateDoc(ref, { name: data.name, updatedAt: F.serverTimestamp() });
      return;
    }
    await F.setDoc(ref, data);
  }

  async function top(seasonId, n = 50) {
    const snap = await F.getDocs(F.query(scores(seasonId), F.orderBy('score', 'desc'), F.limit(n)));
    return snap.docs.map(x => ({ id: x.id, ...x.data(), me: x.id === uid }));
  }

  async function rank(seasonId, score) {
    const c = await F.getCount(F.query(scores(seasonId), F.where('score', '>', score)));
    return c.data().count + 1;
  }

  window.G2ELB = { init, submit, top, rank, get uid() { return uid; } };
})();
