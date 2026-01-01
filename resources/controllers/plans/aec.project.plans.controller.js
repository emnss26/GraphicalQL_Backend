// resources/controllers/plans/aec.project.plans.controller.js
const knex = require("knex")(require("../../../knexfile").development);
const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js");
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const { ensureTables } = require("../../../utils/db/ensureTables");
const { fetchVersionApprovalStatuses } = require("../../libs/acc/acc.get.version.approvals.js");
const axios = require("axios");

/* ----------------------- Helpers de formato ----------------------- */
const normDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

// Elimina acentos, mayúsculas, colapsa espacios
const upperNoAccents = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

// Clave robusta para NÚMEROS: solo A-Z0-9 (quita guiones, etc.)
const keyifyNumber = (s) => upperNoAccents(s).replace(/[^A-Z0-9]/g, "");

// Clave robusta para NOMBRES: letras/números y un solo espacio
const keyifyName = (s) =>
  upperNoAccents(s).replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/* ----------- Helpers para extraer props de AEC GraphQL ----------- */
function getPropValue(propsObj, propName) {
  try {
    const arr = propsObj?.results || [];
    const hit = arr.find(
      (p) => String(p?.name || "").toLowerCase() === String(propName).toLowerCase()
    );
    return hit?.value ?? null;
  } catch {
    return null;
  }
}

// Convierte fechas tipo "dd/mm/aa" o "dd/mm/aaaa" a ISO
function dmyToISO(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10) - 1;
  let y = parseInt(yy, 10);
  if (y < 100) y = 2000 + y;
  const dt = new Date(Date.UTC(y, mo, d));
  return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
}

// Obtiene los 4 campos que necesitamos de un "sheet" (resultado GraphQL)
function extractSheetFields(s) {
  const props = s?.properties || {};
  const number = getPropValue(props, "Sheet Number");
  const name = getPropValue(props, "Sheet Name");
  const rev = getPropValue(props, "Current Revision");
  const revDateRaw = getPropValue(props, "Current Revision Date");

  let revDate = null;
  if (revDateRaw) {
    // Muchas veces viene "dd/mm/aa"
    revDate = dmyToISO(revDateRaw) || normDate(revDateRaw);
  }

  return {
    number: number ? String(number).trim() : "",
    name: name ? String(name).trim() : "",
    currentRevision: rev !== undefined && rev !== null ? String(rev) : "",
    currentRevisionDate: revDate,
  };
}

/* ---------------- Helpers para Docs (ACC) ---------------- */
function normalizeFileBase(displayName) {
  const s = upperNoAccents(displayName);
  // quita extensión
  return s.replace(/\.[A-Z0-9]+$/, "").trim();
}

// Primer token del nombre (hasta espacio o punto). Lo usamos como "número".
function getLeadingSheetNumber(displayName) {
  const s = upperNoAccents(displayName);
  const m = s.match(/^([A-Z0-9-]+)/);
  return m ? m[1] : null;
}

// Devuelve la fecha de la V1. Fallback: createTime del item.
function getV1DateFromInclVersions(item) {
  const ct = item?.attributes?.createTime;
  return normDate(ct);
}

/* ---------------------- CRUD de planes ---------------------- */
const listPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);

    const rows = await knex("user_plans")
      .where({ project_id: req.params.projectId })
      .orderBy("id", "asc");

    // Siempre responde con data: { plans: [...] }
    res.json({
      success: true,
      message: "Planes listados",
      data: { plans: Array.isArray(rows) ? rows : [] },
      error: null,
    });
  } catch (e) {
    e.code = e.code || "PlanListError";
    return next(e);
  }
};

const importPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);

    const projectId = req.params.projectId;
    const { plans = [] } = req.body || {};
    
    if (!Array.isArray(plans) || !plans.length) {
      const error = new Error("Payload vacío");
      error.status = 400;
      error.code = "ValidationError";
      return next(error);
    }

    // --- CORRECCIÓN 1: Regex permite minúsculas (a-z) para detectar extensiones como .pdf ---
    const looksLikeNumber = (s) => /^[a-zA-Z0-9_.-]+$/.test(String(s || "").trim());
    
    const normalizeRows = plans.map((p) => {
      let name = String(p.name || "").trim();
      let number = String(p.number || "").trim();

      // Heurística para detectar columnas invertidas
      const nameIsNumber = looksLikeNumber(name) && !/\s/.test(name);
      const numberLooksLikeName = /\s/.test(number) || /[a-záéíóúñ]/i.test(number);

      if (nameIsNumber && numberLooksLikeName) {
        // SWAP: Corregimos la inversión automáticamente
        const tmp = name; 
        name = number; 
        number = tmp;
      }
      return {
        name, 
        number,
        plannedGenDate: p.plannedGenDate,
        plannedReviewDate: p.plannedReviewDate,
        plannedIssueDate: p.plannedIssueDate,
      };
    });

    // --- CORRECCIÓN 2: Transacción para rendimiento y evitar timeouts ---
    await knex.transaction(async (trx) => {
      for (const p of normalizeRows) {
        const row = {
          project_id: projectId,
          name: String(p.name || "").trim(),
          number: p.number != null && String(p.number).trim() !== "" ? String(p.number).trim() : null,
          planned_gen_date: normDate(p.plannedGenDate),
          planned_review_date: normDate(p.plannedReviewDate),
          planned_issue_date: normDate(p.plannedIssueDate),
        };

        if (row.number) {
          const existing = await trx("user_plans")
            .where({ project_id: projectId, number: row.number })
            .first();
            
          if (existing) {
            await trx("user_plans").where({ id: existing.id }).update({
              name: row.name,
              planned_gen_date: row.planned_gen_date,
              planned_review_date: row.planned_review_date,
              planned_issue_date: row.planned_issue_date,
              updated_at: knex.fn.now(),
            });
          } else {
            await trx("user_plans").insert({
              ...row,
              created_at: knex.fn.now(),
              updated_at: knex.fn.now(),
            });
          }
        } else {
          // Si no hay número, insertamos siempre (opcional, depende de tu lógica)
          await trx("user_plans").insert({
            ...row,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
        }
      }
    });

    const rows = await knex("user_plans")
      .where({ project_id: projectId })
      .orderBy("id", "asc");

    res.json({ success: true, message: "Planes importados", data: { plans: rows }, error: null });
  } catch (e) {
    console.error("Error importando:", e);
    e.code = e.code || "PlanImportError";
    return next(e);
  }
};


const updatePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);

    const { projectId, id } = {
      projectId: req.params.projectId,
      id: Number(req.params.id),
    };
    
    // Agregamos las nuevas columnas a la lista permitida
    const allowed = {
      name: (v) => String(v || "").trim(),
      number: (v) => {
        const s = String(v || "").trim();
        return s === "" ? null : s;
      },
      plannedGenDate: normDate,
      actualGenDate: normDate,
      plannedReviewDate: normDate,
      actualReviewDate: normDate,
      plannedIssueDate: normDate,
      actualIssueDate: normDate,
      currentRevision: (v) => String(v || "").trim(),
      currentRevisionDate: normDate,
      status: (v) => String(v || "").trim(),
      
      // === NUEVOS CAMPOS ===
      docsVersion: (v) => (v === "" || v === null ? null : Number(v)),
      docsVersionDate: normDate,
      lastReviewDate: normDate,
      lastReviewStatus: (v) => String(v || "").trim(),
      issueUpdatedAt: normDate,
      issueVersionSetName: (v) => String(v || "").trim(),
      hasApprovalFlow: (v) => (v === true || v === "true" || v === 1 ? 1 : 0),
    };

    const patch = {};
    for (const k of Object.keys(req.body || {})) {
      if (k in allowed) {
        // Mapeo de nombreFrontend -> nombre_db
        const dbKey = k
          .replace("plannedGenDate", "planned_gen_date")
          .replace("actualGenDate", "actual_gen_date")
          .replace("plannedReviewDate", "planned_review_date")
          .replace("actualReviewDate", "actual_review_date")
          .replace("plannedIssueDate", "planned_issue_date")
          .replace("actualIssueDate", "actual_issue_date")
          .replace("currentRevisionDate", "current_revision_date")
          .replace("currentRevision", "current_revision")
          
          // === MAPEO DE NUEVOS CAMPOS ===
          .replace("docsVersionDate", "docs_last_modified")
          .replace("docsVersion", "docs_version_number")
          .replace("lastReviewDate", "latest_review_date")
          .replace("lastReviewStatus", "latest_review_status")
          .replace("issueUpdatedAt", "sheet_updated_at")
          .replace("issueVersionSetName", "sheet_version_set")
          .replace("hasApprovalFlow", "has_approval_flow");

        patch[dbKey] = allowed[k](req.body[k]);
      }
    }
    
    if (!Object.keys(patch).length) {
      const error = new Error("Nada que actualizar");
      error.status = 400;
      error.code = "ValidationError";
      return next(error);
    }

    const exists = await knex("user_plans")
      .where({ id, project_id: projectId })
      .first();
    if (!exists) {
      const error = new Error("Plan no encontrado");
      error.status = 404;
      error.code = "NotFound";
      return next(error);
    }

    patch.updated_at = knex.fn.now();
    await knex("user_plans").where({ id }).update(patch);
    const updated = await knex("user_plans").where({ id }).first();
    res.json({ success: true, message: "Plan actualizado", data: { plan: updated }, error: null });
  } catch (e) {
    e.code = e.code || "PlanUpdateError";
    return next(e);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);

    const { projectId, id } = {
      projectId: req.params.projectId,
      id: Number(req.params.id),
    };
    await knex("user_plans").where({ id, project_id: projectId }).del();
    res.json({ success: true, message: "Plan eliminado", data: null, error: null });
  } catch (e) {
    e.code = e.code || "PlanDeleteError";
    return next(e);
  }
};


/* ----------------- MATCH: AEC (modelos) + ACC (folder) ----------------- */
/* ----------------- MATCH: AEC (modelos) + ACC (folder) ----------------- */
const matchPlans = async (req, res, next) => {
  try {
    const { fetchReviewById } = require("../../libs/acc/acc.get.review.by.id.js");
    const { fetchProjectSheets } = require("../../libs/acc/acc.get.project.sheets.js");

    const projectId = req.params.projectId;
    const token = req.cookies["access_token"];
    const altProjectId = req.headers["x-alt-project-id"];
    const selectedFolderId = req.headers["selected-folder-id"];

    if (!token) {
      const error = new Error("Unauthorized");
      error.status = 401; return next(error);
    }
    if (!altProjectId || !selectedFolderId) {
      const error = new Error("Faltan headers de selección.");
      error.status = 400; return next(error);
    }

    // Helpers de IDs
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
    const bProjectId = toBProject(altProjectId);
    const accProjectGuid = toGuid(altProjectId);

    await ensureTables(knex);

    // ============================================================
    // FASE 2: Normalización (PDF + keyifyNumber con guiones)
    // ============================================================

    // Solo removemos .pdf (NO cualquier extensión), para evitar falsos positivos
    // y no romper números tipo "A-101.01"
    const stripPdfExtension = (value) => {
      const s = String(value || "").trim();
      return s.replace(/\.pdf$/i, "");
    };

    // Permite guiones (-). Limpia .pdf ANTES de crear la key.
    // Regla: deja solo [A-Z0-9-] (conserva el guion)
    const keyifyNumber = (value) => {
      const s = stripPdfExtension(value);
      if (!s) return "";
      return String(s)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")        // quita espacios
        .replace(/[^A-Z0-9-]/g, ""); // conserva guiones
    };

    // ============================================================

    // 1) Obtener datos base
    const plans = await knex("user_plans").where({ project_id: projectId });
    const selectedRows = await knex("model_selection").where({ project_id: projectId }).select("model_id");
    const modelIds = selectedRows.map((r) => r.model_id);

    // 2) Obtener Sheets de Modelos (AEC)
    const allSheets = [];
    if (modelIds.length) {
      for (const modelId of modelIds) {
        try {
          const ss = await fetchSheets(token, modelId, "property.name.category==Sheets");
          for (const s of ss) allSheets.push(extractSheetFields(s));
        } catch (e) { console.warn("fetchSheets warn", modelId); }
      }
    }

    const byNumber = new Map();
    const byName = new Map();
    for (const s of allSheets) {
      if (s.number) {
        const cleanNum = stripPdfExtension(s.number);          // <-- Fase 2
        byNumber.set(keyifyNumber(cleanNum), s);              // <-- Fase 2 (guiones)
      }
      if (s.name) byName.set(keyifyName(s.name), s);
    }

    // 3) Obtener Docs (Files)
    const files = await fetchFolderContents(token, altProjectId, selectedFolderId);

    // Mapas para búsqueda rápida de Docs
    const v1ByLeadingNumber = new Map();
    const v1ByFileBase = new Map();
    const itemIdByLeadingNumber = new Map();
    const itemIdByFileBase = new Map();

    for (const f of files || []) {
      if (f?.type !== "items") continue;

      const rawDisplayName = f?.attributes?.displayName || f?.attributes?.name || "";
      const displayName = stripPdfExtension(rawDisplayName); // <-- Fase 2: limpiar .pdf antes de extraer claves

      const v1Date = getV1DateFromInclVersions(f);
      const itemId = f?.id || null;

      const base = normalizeFileBase(displayName);          // <-- ya sin .pdf
      const lead = getLeadingSheetNumber(displayName);      // <-- ya sin .pdf

      if (v1Date) {
        if (lead) v1ByLeadingNumber.set(keyifyNumber(lead), v1Date); // <-- Fase 2 (guiones)
        if (base) v1ByFileBase.set(keyifyName(base), v1Date);
      }
      if (itemId) {
        if (lead) itemIdByLeadingNumber.set(keyifyNumber(lead), itemId); // <-- Fase 2 (guiones)
        if (base) itemIdByFileBase.set(keyifyName(base), itemId);
      }
    }

    // Helper de versiones
    const fetchItemVersions = async (itemId) => {
      try {
        const url = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(bProjectId)}/items/${encodeURIComponent(itemId)}/versions`;
        const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        return Array.isArray(data?.data) ? data.data : [];
      } catch (e) { return []; }
    };

    // 4) Obtener Sheets de ACC Reviews (Emisión Real)
    let projectSheets = [];
    try {
      projectSheets = await fetchProjectSheets(token, accProjectGuid, 200);
    } catch (err) { projectSheets = []; }

    const currentSheetsByNum = new Map();
    for (const sh of projectSheets) {
      if (!sh?.isCurrent) continue;

      const cleanNum = stripPdfExtension(sh.number);   // <-- Fase 2
      const k = keyifyNumber(cleanNum);                // <-- Fase 2 (guiones)

      if (k) {
        const prev = currentSheetsByNum.get(k);
        if (!prev || new Date(sh.createdAt) > new Date(prev.createdAt)) {
          currentSheetsByNum.set(k, sh);
        }
      }
    }

    // Mapeo de Status
    const normalizeStatus = (val) => {
      const v = String(val || "").toUpperCase();
      if (v === "A" || v === "APPROVED" || v.includes("APROB")) return "APPROVED";
      if (v === "R" || v === "REJECTED" || v.includes("RECHAZ")) return "REJECTED";
      if (v === "OPEN" || v === "IN_REVIEW" || v.includes("REVISI")) return "IN_REVIEW";
      return v || "";
    };

    const patches = [];
    const details = [];

    // --- FUNCIÓN DE PROCESAMIENTO UNITARIO (SE EJECUTARÁ EN PARALELO) ---
    const processPlan = async (p) => {
      // Limpieza de claves (FASE 2: solo .pdf, NO regex agresivo)
      const dbNumberClean = stripPdfExtension(p.number || ""); // <-- Fase 2
      const kNum = keyifyNumber(dbNumberClean);                // <-- Fase 2 (guiones)
      const kName = keyifyName(p.name);

      // Match Model
      let hit = null;
      if (kNum && byNumber.has(kNum)) hit = byNumber.get(kNum);
      else if (kName && byName.has(kName)) hit = byName.get(kName);

      // Match Docs (Solo necesitamos ItemId y V1 Date)
      let v1 = null;
      let itemId = null;

      if (kNum && v1ByLeadingNumber.has(kNum)) v1 = v1ByLeadingNumber.get(kNum);
      else if (kName && v1ByFileBase.has(kName)) v1 = v1ByFileBase.get(kName);

      if (kNum && itemIdByLeadingNumber.has(kNum)) itemId = itemIdByLeadingNumber.get(kNum);
      else if (kName && itemIdByFileBase.has(kName)) itemId = itemIdByFileBase.get(kName);

      // Match Sheets (Emisión Real)
      let matchedSheet = null;
      if (kNum && currentSheetsByNum.has(kNum)) matchedSheet = currentSheetsByNum.get(kNum);

      // --- ANÁLISIS PROFUNDO DE VERSIONES ---
      let everApproved = false;
      let absoluteFirstReviewDate = null;
      let latestReviewStatus = null;
      let latestReviewDate = null;
      let lastVersionNumber = null;
      let lastVersionDate = null;

      if (itemId) {
        const versions = await fetchItemVersions(itemId);

        // Ordenamos: v1, v2, v3... (Ascendente)
        const ascendingVersions = [...versions].sort((a, b) =>
          (a.attributes?.versionNumber || 0) - (b.attributes?.versionNumber || 0)
        );

        if (ascendingVersions.length > 0) {
          // Datos de la última versión
          const tip = ascendingVersions[ascendingVersions.length - 1];
          lastVersionNumber = tip.attributes?.versionNumber;
          lastVersionDate = tip.attributes?.lastModifiedTime || tip.attributes?.createTime;
        }

        // Iteramos historial completo
        for (const ver of ascendingVersions) {
          const vId = ver.id;
          try {
            // Obtenemos flujo de aprobación de ESTA versión
            const statuses = await fetchVersionApprovalStatuses(token, altProjectId, vId);

            if (statuses && statuses.length > 0) {
              const finalState = statuses[statuses.length - 1];
              const statusStr = normalizeStatus(finalState.approvalStatus?.value || finalState.approvalStatus?.label);

              // 1. Check de Aprobación Histórica
              if (statusStr === "APPROVED") everApproved = true;

              // Obtenemos fecha de esta revisión
              let reviewDate = null;
              if (finalState.review?.id) {
                const r = await fetchReviewById(token, accProjectGuid, finalState.review.id);
                reviewDate = r?.createdAt || null;
              }

              // 2. Primera Fecha de Revisión (Global)
              if (reviewDate && !absoluteFirstReviewDate) {
                absoluteFirstReviewDate = reviewDate;
              }

              // 3. Actualizamos "Latest"
              latestReviewStatus = statusStr;
              latestReviewDate = reviewDate;
            }
          } catch (err) { /* Ignorar 404 */ }
        }
      }

      // --- CONSTRUCCIÓN DEL PATCH ---
      const patch = {};

      if (hit) {
        if (hit.currentRevision) patch.current_revision = hit.currentRevision;
        if (hit.currentRevisionDate) patch.current_revision_date = hit.currentRevisionDate;
      }

      if (v1) patch.actual_gen_date = v1;
      if (lastVersionNumber) patch.docs_version_number = lastVersionNumber;
      if (lastVersionDate) patch.docs_last_modified = normDate(lastVersionDate);

      // Lógica de Negocio
      patch.has_approval_flow = everApproved ? 1 : 0;

      if (absoluteFirstReviewDate) patch.actual_review_date = normDate(absoluteFirstReviewDate);
      if (latestReviewStatus) patch.latest_review_status = latestReviewStatus;
      if (latestReviewDate) patch.latest_review_date = normDate(latestReviewDate);

      if (matchedSheet) {
        if (matchedSheet.createdAt) patch.actual_issue_date = normDate(matchedSheet.createdAt);
        if (matchedSheet.updatedAt) patch.sheet_updated_at = normDate(matchedSheet.updatedAt);
        if (matchedSheet.versionSet?.name) patch.sheet_version_set = matchedSheet.versionSet.name;
      }

      if (Object.keys(patch).length > 0) {
        patch.updated_at = knex.fn.now();
        return { id: p.id, patch, details: { id: p.id, key: kNum, everApproved, firstDate: absoluteFirstReviewDate, latest: latestReviewStatus } };
      }
      return null;
    };

    // --- EJECUCIÓN POR LOTES (BATCHES) ---
    const BATCH_SIZE = 5;

    for (let i = 0; i < plans.length; i += BATCH_SIZE) {
      const batch = plans.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(p => processPlan(p)));

      for (const res of results) {
        if (res) {
          patches.push({ id: res.id, patch: res.patch });
          if (res.details) details.push(res.details);
        }
      }
    }

    // Transacción de actualización masiva
    if (patches.length) {
      await knex.transaction(async (trx) => {
        for (const { id, patch } of patches) {
          await trx("user_plans").where({ id }).update(patch);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Match completado (Optimizado con Lotes Paralelos).",
      data: { matchedPlans: patches.length, details }
    });

  } catch (e) {
    console.error("Match error:", e);
    return next(e);
  }
};


module.exports = {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
};
