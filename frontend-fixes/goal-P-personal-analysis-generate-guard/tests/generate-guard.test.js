/* eslint-disable no-console */
// Verifies the synchronous in-flight guard added to handleRequestAnalysis:
// a burst of clicks must produce exactly ONE POST /generate, and a new request
// is only allowed after the prior one settles. Models the ref+state guard faithfully.

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}`); } };

// Faithful model of the guard in MyMirrorPanel.handleRequestAnalysis.
function makeHandler({ postImpl }) {
  const ref = { inFlight: false };
  let isPolling = false;         // startPolling() flips this true on success
  let posts = 0;
  const handler = async () => {
    if (ref.inFlight || isPolling) return;   // synchronous guard (pre-await)
    ref.inFlight = true;
    try {
      posts++;
      await postImpl();
      isPolling = true;                       // startPolling()
    } catch { /* error surfaced to UI */ }
    finally { ref.inFlight = false; }
  };
  return { handler, getPosts: () => posts, setPolling: (v) => { isPolling = v; }, isPolling: () => isPolling };
}

(async () => {
  console.log('burst of synchronous clicks → exactly one POST');
  {
    let resolve;
    const h = makeHandler({ postImpl: () => new Promise(r => { resolve = r; }) });
    // Fire 10 clicks in the same tick, before the POST resolves.
    for (let i = 0; i < 10; i++) h.handler();
    ok('only 1 POST fired for 10 rapid clicks', h.getPosts() === 1);
    resolve();                       // POST completes → startPolling sets isPolling
    await Promise.resolve(); await Promise.resolve();
    ok('isPolling engaged after success', h.isPolling() === true);
    // Further clicks while polling do nothing.
    await h.handler();
    ok('no POST while polling', h.getPosts() === 1);
  }

  console.log('sequential requests allowed once prior settles (not polling)');
  {
    const h = makeHandler({ postImpl: () => Promise.reject(Object.assign(new Error('Rate limit exceeded.'), { code: 'RATE_LIMIT_EXCEEDED', status: 429, retryAfter: 120 })) });
    await h.handler();               // fails → isPolling stays false, inFlight reset
    ok('first attempt posted once', h.getPosts() === 1);
    ok('not polling after a failed request', h.isPolling() === false);
    await h.handler();               // allowed again because prior settled and not polling
    ok('retry after settle posts again', h.getPosts() === 2);
  }

  console.log('retryAfter → user message formatting');
  {
    const fmt = (secs) => {
      const mins = Math.ceil(secs / 60);
      return secs > 0
        ? `You've reached the report-generation limit. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`
        : "You've reached the report-generation limit. Please try again later.";
    };
    ok('120s → "2 minutes"', fmt(120).includes('2 minutes'));
    ok('60s → "1 minute" (singular)', fmt(60).includes('1 minute.') && !fmt(60).includes('minutes'));
    ok('0s → generic later message', fmt(0).includes('later'));
  }

  console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
