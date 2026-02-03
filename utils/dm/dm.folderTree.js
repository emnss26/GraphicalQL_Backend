const { fetchTopFoldersRest } = require("../../resources/libs/dm/dm.get.topfolder.js");
const { fetchSubFoldersRest } = require("../../resources/libs/dm/dm.get.subfolder.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createWorkQueue(concurrency) {
  let running = 0;
  const q = [];
  let idleResolve = null;

  const onIdle = () =>
    new Promise((res) => {
      if (running === 0 && q.length === 0) return res();
      idleResolve = res;
    });

  const pump = () => {
    while (running < concurrency && q.length) {
      const fn = q.shift();
      running++;
      Promise.resolve()
        .then(fn)
        .catch(() => {}) 
        .finally(() => {
          running--;
          pump();
          if (running === 0 && q.length === 0 && idleResolve) {
            idleResolve();
            idleResolve = null;
          }
        });
    }
  };

  const push = (fn) => {
    q.push(fn);
    pump();
  };

  return { push, onIdle };
}

function createRateLimiter({ maxConcurrent = 4, minTimeMs = 80 }) {
  let active = 0;
  let lastStart = 0;
  let pauseUntil = 0;
  const waiters = [];

  const acquire = async () => {
    while (active >= maxConcurrent) {
      await new Promise((res) => waiters.push(res));
    }
    active++;
  };

  const release = () => {
    active--;
    if (waiters.length) waiters.shift()();
  };

  const waitTurn = async () => {
    const now = Date.now();
    if (now < pauseUntil) await sleep(pauseUntil - now);

    const since = now - lastStart;
    if (since < minTimeMs) await sleep(minTimeMs - since);

    lastStart = Date.now();
  };

  const run = async (fn) => {
    await acquire();
    try {
      await waitTurn();
      return await fn();
    } finally {
      release();
    }
  };

  const pause = (ms) => {
    pauseUntil = Math.max(pauseUntil, Date.now() + ms);
  };

  return { run, pause };
}

async function fetchFolderTree(token, projectId) {
  const dmId = projectId;

  const MAX_CONCURRENCY = Number(process.env.DM_TREE_CONCURRENCY || 4);
  const MIN_TIME_MS = Number(process.env.DM_TREE_MIN_TIME_MS || 80);    
  const RETRIES = Number(process.env.DM_TREE_RETRIES || 6);

  const limiter = createRateLimiter({ maxConcurrent: MAX_CONCURRENCY, minTimeMs: MIN_TIME_MS });
  const work = createWorkQueue(MAX_CONCURRENCY);

  const childrenPromiseCache = new Map(); 

  const nodeById = new Map(); 

  const getNode = (info) => {
    if (nodeById.has(info.id)) return nodeById.get(info.id);
    const node = {
      id: info.id,
      name: info.name,
      objectCount: info.objectCount || 0,
      type: "folders",
      children: [],
    };
    nodeById.set(info.id, node);
    return node;
  };

  const retry = async (operation, label) => {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        return await limiter.run(operation);
      } catch (error) {
        const status = error.response?.status;
        const isRetryable = status === 429 || status >= 500;

        if (!isRetryable || attempt === RETRIES - 1) throw error;

        const ra = Number(error.response?.headers?.["retry-after"]);
        let waitMs = (!Number.isNaN(ra) && ra > 0)
          ? Math.ceil(ra * 1000)
          : 1000 * Math.pow(2, attempt);

        waitMs += Math.floor(Math.random() * 250);

        limiter.pause(waitMs);
        console.warn(`⏳ APS ${status} en "${label}". Retry ${attempt + 1}/${RETRIES} en ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
  };

  const getChildrenInfo = (folderNode) => {
    if (childrenPromiseCache.has(folderNode.id)) return childrenPromiseCache.get(folderNode.id);

    const p = retry(
      () => fetchSubFoldersRest(token, dmId, folderNode.id),
      folderNode.name || folderNode.id
    );

    childrenPromiseCache.set(folderNode.id, p);
    return p;
  };

  const topInfos = await retry(() => fetchTopFoldersRest(token, dmId), "topFolders");
  const roots = (topInfos || []).map(getNode);

  const expanded = new Set(); 

  const expand = (node) => {
    work.push(async () => {
      if (expanded.has(node.id)) return;
      expanded.add(node.id);

      try {
        const childrenInfos = await getChildrenInfo(node);
        const childNodes = (childrenInfos || []).map(getNode);
        node.children = childNodes;

        for (const child of childNodes) expand(child);
      } catch (e) {
        console.error(`⚠️ Error irrecuperable en carpeta "${node.name}". Se omiten sus hijos.`);
        node.children = [];
        node.error = "Load failed";
      }
    });
  };

  for (const r of roots) expand(r);
  await work.onIdle();

  return roots;
}

module.exports = { fetchFolderTree };
