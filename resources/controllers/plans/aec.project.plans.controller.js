const knex = require("knex")(require("../../../knexfile").development);
const axios = require("axios");

const { ensureTables } = require("../../../utils/db/ensureTables");
const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js"); // GraphQL Sheets
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const { fetchVersionApprovalStatuses } = require("../../libs/acc/acc.get.version.approvals.js");
const { fetchReviewById } = require("../../libs/acc/acc.get.review.by.id.js");

const { fetchProjectSheets } = require("../../libs/acc/acc.get.project.sheets.js");

const normDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const normalizeText = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

const stripPdfExtension = (v) => String(v || "").trim().replace(/\.pdf$/i, "");

const keyifyNumber = (v) => {
  const s = normalizeText(stripPdfExtension(v));
  if (!s) return "";
  return s.replace(/[^A-Z0-9]/g, ""); 
};

const keyifyName = (v) => {
  const s = normalizeText(v);
  if (!s) return "";
  return s.replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
};

function getPropValue(propsObj, propNames) {
  try {
    const arr = propsObj?.results || [];
    if (!arr.length) return null;
    const targets = Array.isArray(propNames) ? propNames : [propNames];
    const hit = arr.find((p) => {
      const pName = String(p?.name || "").trim().toLowerCase();
      return targets.some(t => pName === String(t).toLowerCase());
    });
    return hit?.value ?? null;
  } catch (e) {
    return null;
  }
}

function dmyToISO(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10) - 1;
  let y = parseInt(yy, 10);
  if (y < 100) y = 2000 + y;
  const dt = new Date(Date.UTC(y, mo, d));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

function extractSheetFields(s) {
  const props = s?.properties || {};
  const number = getPropValue(props, ["Sheet Number", "Number", "Número de plano"]);
  const name = getPropValue(props, ["Sheet Name", "Name", "Nombre de plano", "Title"]);
  const rev = getPropValue(props, ["Current Revision", "Revision"]);
  const revDateRaw = getPropValue(props, ["Current Revision Date", "Revision Date"]);
  const revDate = revDateRaw ? (dmyToISO(revDateRaw) || normDate(revDateRaw)) : null;

  return {
    number: number ? String(number).trim() : "",
    name: name ? String(name).trim() : (s.name || ""),
    currentRevision: rev !== undefined && rev !== null ? String(rev) : "",
    currentRevisionDate: revDate,
  };
}

function normalizeFileBase(displayName) {
  const s = normalizeText(stripPdfExtension(displayName));
  return s.replace(/\.[A-Z0-9]+$/, "").trim();
}

function getLeadingSheetNumber(displayName) {
  const s = normalizeText(stripPdfExtension(displayName));
  const m = s.match(/^([A-Z0-9-]+)/);
  return m ? m[1] : null;
}

function getV1DateFromInclVersions(item) {
  const ct = item?.attributes?.createTime;
  return normDate(ct);
}

const toBProject = (pid) => {
  const s = String(pid || "");
  if (s.startsWith("b.")) return s;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? `b.${m[0]}` : s;
};

const toGuid = (pid) => {
  const s = String(pid || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop();
  return s.replace(/^b\./i, "");
};

const listPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const rows = await knex("user_plans").where({ project_id: req.params.projectId }).orderBy("id", "asc");
    return res.json({ success: true, message: "Planes listados", data: { plans: Array.isArray(rows) ? rows : [] }, error: null });
  } catch (err) { err.code = err.code || "PlanListError"; return next(err); }
};

const importPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const { plans = [] } = req.body || {};

    if (!Array.isArray(plans) || plans.length === 0) {
      const err = new Error("Payload vacío"); err.status = 400; err.code = "ValidationError"; return next(err);
    }

    const looksLikeNumberToken = (s) => /^[a-zA-Z0-9_.-]+$/.test(String(s || "").trim());
    const normalized = plans.map((p) => {
      let name = String(p.name || "").trim();
      let number = String(p.number || "").trim();
      const nameIsToken = looksLikeNumberToken(name) && !/\s/.test(name);
      const numberLooksLikeName = /\s/.test(number) || /[a-záéíóúñ]/i.test(number);
      if (nameIsToken && numberLooksLikeName) { const tmp = name; name = number; number = tmp; }
      return { name, number, plannedGenDate: p.plannedGenDate, plannedReviewDate: p.plannedReviewDate, plannedIssueDate: p.plannedIssueDate };
    });

    await knex.transaction(async (trx) => {
      for (const p of normalized) {
        const row = {
          project_id: projectId, name: String(p.name || "").trim(),
          number: p.number != null && String(p.number).trim() !== "" ? String(p.number).trim() : null,
          planned_gen_date: normDate(p.plannedGenDate), planned_review_date: normDate(p.plannedReviewDate), planned_issue_date: normDate(p.plannedIssueDate),
        };
        if (row.number) {
          const existing = await trx("user_plans").where({ project_id: projectId, number: row.number }).first();
          if (existing) { await trx("user_plans").where({ id: existing.id }).update({ ...row, updated_at: knex.fn.now() }); }
          else { await trx("user_plans").insert({ ...row, created_at: knex.fn.now(), updated_at: knex.fn.now() }); }
        } else {
          await trx("user_plans").insert({ ...row, created_at: knex.fn.now(), updated_at: knex.fn.now() });
        }
      }
    });
    const rows = await knex("user_plans").where({ project_id: projectId }).orderBy("id", "asc");
    return res.json({ success: true, message: "Planes importados", data: { plans: rows }, error: null });
  } catch (err) { err.code = err.code || "PlanImportError"; return next(err); }
}

const updatePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const { projectId, id } = { projectId: req.params.projectId, id: Number(req.params.id) };
    const patch = {}; 
    const validators = {
        name: (v) => String(v || "").trim(), number: (v) => String(v || "").trim() || null,
        plannedGenDate: normDate, actualGenDate: normDate, plannedReviewDate: normDate, actualReviewDate: normDate, plannedIssueDate: normDate,
        actualIssueDate: normDate, currentRevision: (v) => String(v || "").trim(), currentRevisionDate: normDate, status: (v) => String(v || "").trim(),
        docsVersion: (v) => (v === "" || v === null ? null : Number(v)), docsVersionDate: normDate, lastReviewDate: normDate, lastReviewStatus: (v) => String(v || "").trim(),
        issueUpdatedAt: normDate, issueVersionSetName: (v) => String(v || "").trim(), hasApprovalFlow: (v) => (v === true || v === "true" || v === 1 ? 1 : 0),
    };
    const fieldToDb = {
        plannedGenDate: "planned_gen_date", actualGenDate: "actual_gen_date", plannedReviewDate: "planned_review_date", actualReviewDate: "actual_review_date",
        plannedIssueDate: "planned_issue_date", actualIssueDate: "actual_issue_date", currentRevision: "current_revision", currentRevisionDate: "current_revision_date",
        docsVersion: "docs_version_number", docsVersionDate: "docs_last_modified", lastReviewDate: "latest_review_date", lastReviewStatus: "latest_review_status",
        issueUpdatedAt: "sheet_updated_at", issueVersionSetName: "sheet_version_set", hasApprovalFlow: "has_approval_flow",
    };
    for (const k of Object.keys(req.body || {})) {
        if (k in validators) patch[fieldToDb[k] || k] = validators[k](req.body[k]);
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({error: "Nada que actualizar"});
    patch.updated_at = knex.fn.now();
    await knex("user_plans").where({ id }).update(patch);
    const updated = await knex("user_plans").where({ id }).first();
    return res.json({ success: true, message: "Plan actualizado", data: { plan: updated }, error: null });
  } catch (err) { return next(err); }
};

const deletePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const { projectId, id } = { projectId: req.params.projectId, id: Number(req.params.id) };
    await knex("user_plans").where({ id, project_id: projectId }).del();
    return res.json({ success: true, message: "Plan eliminado", data: null, error: null });
  } catch (err) { err.code = err.code || "PlanDeleteError"; return next(err); }
};

// --- MATCH PLANS 
  const matchPlans = async (req, res, next) => {
  console.time("MatchProcess");
  try {
    const projectId = req.params.projectId;
    const token = req.cookies?.access_token;
    const altProjectId = req.headers["x-alt-project-id"];
    const selectedFolderId = req.headers["selected-folder-id"];

    if (!token || !altProjectId || !selectedFolderId) { 
        const err = new Error("Faltan credenciales o headers."); err.status = 400; return next(err); 
    }

    await ensureTables(knex);
    const bProjectId = toBProject(altProjectId);
    const accProjectGuid = toGuid(altProjectId);

    async function fetchWithRetryLocal(url, retries = 3, delay = 500) {
        try {
            const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            return data;
        } catch (err) {
            if (retries > 0 && err.response && [429, 500, 502, 503].includes(err.response.status)) {
                await new Promise(r => setTimeout(r, delay));
                return fetchWithRetryLocal(url, retries - 1, delay * 2);
            }
            throw err;
        }
    }

    const pModelIds = knex("model_selection").where({ project_id: projectId }).select("model_id").then(rows => rows.map(r => r.model_id));
 
    const pPlans = knex("user_plans").where({ project_id: projectId });
    
    const pDocs = fetchFolderContents(token, altProjectId, selectedFolderId);

    const pAccSheets = fetchProjectSheets(token, accProjectGuid, 200).catch((e) => {
        console.error("Error fetching ACC sheets:", e.message);
        return [];
    });

    const [modelIds, plans, docsFiles, accSheets] = await Promise.all([pModelIds, pPlans, pDocs, pAccSheets]);

    //console.log(`📊 Total ACC Sheets Recibidos: ${accSheets.length}`);

    const byNumber = new Map();
    const byName = new Map();

    for (const mid of modelIds) {
        try {
            const ss = await fetchSheets(token, mid, "property.name.category==Sheets");
            for (const s of ss) {
                const f = extractSheetFields(s);
                if (f.number) byNumber.set(keyifyNumber(f.number), f);
                if (f.name) byName.set(keyifyName(f.name), f);
            }
        } catch {}
    }

    const docsV1Map = new Map();
    const docsIdMap = new Map();
    for (const f of docsFiles || []) {
        if (f.type !== "items") continue;
        const name = f.attributes?.displayName || f.attributes?.name || "";
        const kNum = keyifyNumber(getLeadingSheetNumber(name));
        const kNam = keyifyName(normalizeFileBase(name));
        const v1 = getV1DateFromInclVersions(f);
        if (kNum) { if(v1) docsV1Map.set(kNum, v1); docsIdMap.set(kNum, f.id); }
        if (kNam) { if(v1 && !docsV1Map.has(kNam)) docsV1Map.set(kNam, v1); if(!docsIdMap.has(kNam)) docsIdMap.set(kNam, f.id); }
    }

    const accSheetsMap = new Map();
    for (const sh of accSheets) {
        if (sh.isCurrent) accSheetsMap.set(keyifyNumber(sh.number), sh);
    }

    const fetchItemVersions = async (itemId) => {
        const url = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(bProjectId)}/items/${encodeURIComponent(itemId)}/versions`;
        try { 
            const data = await fetchWithRetryLocal(url); 
            return Array.isArray(data?.data) ? data.data : [];
        } catch { return []; }
    };

    const normalizeStatus = (val) => {
        const v = String(val || "").toUpperCase().trim();
        if (["APPROVED", "APROBADO", "A"].includes(v) || v.includes("APROB")) return "APPROVED";
        if (["REJECTED", "RECHAZADO", "REJECT", "R"].includes(v) || v.includes("RECHAZ")) return "REJECTED";
        if (["OPEN", "IN_REVIEW", "EN REVISIÓN"].includes(v)) return "IN_REVIEW";
        return v || "";
    };

    const reviewCache = new Map();
    const analyzeApprovalFlow = async (itemId) => {
        let result = { everApproved: false, firstReviewDate: null, latestReviewStatus: null, latestReviewDate: null, lastVersionNumber: null, lastVersionDate: null };
        const versions = await fetchItemVersions(itemId);
        const ascending = versions.sort((a, b) => (a.attributes?.versionNumber || 0) - (b.attributes?.versionNumber || 0));

        if (ascending.length > 0) {
            const last = ascending[ascending.length - 1];
            result.lastVersionNumber = last.attributes?.versionNumber;
            result.lastVersionDate = last.attributes?.lastModifiedTime || last.attributes?.createTime;
        }

        for (const ver of ascending) {
            try {
                const statuses = await fetchVersionApprovalStatuses(token, altProjectId, ver.id);
                if (!statuses.length) continue;
                
                const sorted = statuses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                for (const st of sorted) {
                    if (normalizeStatus(st.approvalStatus?.value || st.approvalStatus?.label) === "APPROVED") {
                        result.everApproved = true;
                    }
                }

                const final = sorted[sorted.length - 1];
                const statusStr = normalizeStatus(final.approvalStatus?.value || final.approvalStatus?.label);
                
                let rDate = null;
                if (final.review?.id) {
                    if (reviewCache.has(final.review.id)) rDate = reviewCache.get(final.review.id);
                    else {
                        try {
                            const r = await fetchReviewById(token, accProjectGuid, final.review.id);
                            rDate = r?.createdAt || null;
                        } catch {}
                        reviewCache.set(final.review.id, rDate);
                    }
                }

                if (rDate && !result.firstReviewDate) result.firstReviewDate = rDate;
                if (statusStr) {
                    result.latestReviewStatus = statusStr;
                    result.latestReviewDate = rDate;
                }
            } catch (e) { /* continue */ }
        }
        return result;
    };

    const BATCH_SIZE = 15; 
    const SLEEP_MS = 300; 
    const patches = [];
    const details = [];

    const processPlan = async (p) => {
        const kNum = keyifyNumber(p.number);
        const kName = keyifyName(p.name);
        
        const modelHit = (kNum && byNumber.get(kNum)) || (kName && byName.get(kName)) || null;
        const v1Date = (kNum && docsV1Map.get(kNum)) || (kName && docsV1Map.get(kName)) || null;
        const itemId = (kNum && docsIdMap.get(kNum)) || (kName && docsIdMap.get(kName)) || null;
        const sheetHit = (kNum && accSheetsMap.get(kNum)) || null;

        const app = itemId ? await analyzeApprovalFlow(itemId) : null;

        const patch = {};
        
        // Data del Modelo (Revit)
        if (modelHit) {
            if (modelHit.currentRevision) patch.current_revision = modelHit.currentRevision;
            if (modelHit.currentRevisionDate) patch.current_revision_date = modelHit.currentRevisionDate;
        }
        
        if (v1Date) patch.actual_gen_date = v1Date;
     
        if (app) {
            if (app.lastVersionNumber) patch.docs_version_number = app.lastVersionNumber;
            if (app.lastVersionDate) patch.docs_last_modified = normDate(app.lastVersionDate);
            patch.has_approval_flow = app.everApproved ? 1 : 0;
            if (app.firstReviewDate) patch.actual_review_date = normDate(app.firstReviewDate);
            if (app.latestReviewStatus) patch.latest_review_status = app.latestReviewStatus;
            if (app.latestReviewDate) patch.latest_review_date = normDate(app.latestReviewDate);
        }

        if (sheetHit) {
            if (sheetHit.createdAt) patch.actual_issue_date = normDate(sheetHit.createdAt);
            if (sheetHit.updatedAt) patch.sheet_updated_at = normDate(sheetHit.updatedAt);
            if (sheetHit.versionSet?.name) patch.sheet_version_set = sheetHit.versionSet.name;
        }

        if (Object.keys(patch).length > 0) {
            patch.updated_at = knex.fn.now();
            return { id: p.id, patch, details: { id: p.id, key: kNum } };
        }
        return null;
    };

    for (let i = 0; i < plans.length; i += BATCH_SIZE) {
        const batch = plans.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(processPlan)); 
        for (const r of results) {
            if (r) {
                patches.push({ id: r.id, patch: r.patch });
                details.push(r.details);
            }
        }
        if (i + BATCH_SIZE < plans.length) await new Promise(r => setTimeout(r, SLEEP_MS));
    }

    if (patches.length > 0) {
        await knex.transaction(async (trx) => {
            for (const { id, patch } of patches) {
                await trx("user_plans").where({ id }).update(patch);
            }
        });
    }

    console.timeEnd("MatchProcess");
    return res.status(200).json({
        success: true,
        message: `Sincronización completada. ${patches.length} planos actualizados.`,
        data: { matchedPlans: patches.length, sheetsFound: accSheets.length },
    });

  } catch (err) {
    console.error("CRITICAL MATCH ERROR:", err);
    err.code = err.code || "PlanMatchError";
    return next(err);
  }
};

module.exports = { listPlans, importPlans, updatePlan, deletePlan, matchPlans };