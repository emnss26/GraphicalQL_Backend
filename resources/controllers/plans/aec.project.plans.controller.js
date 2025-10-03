// resources/controllers/plans/aec.project.plans.controller.js
const knex = require("knex")(require("../../../knexfile").development);
const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js");
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const { ensureTables } = require("../../../utils/db/ensureTables");
const { fetchVersionApprovalStatuses } = require("../../libs/acc/acc.get.version.approvals.js");
const { fetchReviewById } = require("../../libs/acc/acc.get.review.by.id.js");
const {fetchProjectSheets} = require ("../../libs/acc/acc.get.project.sheets.js")
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
const listPlans = async (req, res) => {
  try {
    await ensureTables(knex);

    const rows = await knex("user_plans")
      .where({ project_id: req.params.projectId })
      .orderBy("id", "asc");
    res.json({ plans: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al listar planes" });
  }
};

const importPlans = async (req, res) => {
  try {
    await ensureTables(knex);

    const projectId = req.params.projectId;
    const { plans = [] } = req.body || {};
    if (!Array.isArray(plans) || !plans.length) {
      return res.status(400).json({ error: "Payload vacío" });
    }

    // --- Heurística opcional: si detectamos que vienen invertidos, los corregimos ---
    const looksLikeNumber = (s) => /^[A-Z0-9_.-]+$/.test(String(s || "").trim());
    const normalizeRows = plans.map((p) => {
      let name = String(p.name || "").trim();
      let number = String(p.number || "").trim();

      const nameIsNumber = looksLikeNumber(name) && !/\s/.test(name);
      const numberLooksLikeName = /\s/.test(number) || /[a-záéíóúñ]/i.test(number);

      if (nameIsNumber && numberLooksLikeName) {
        // swap
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

    for (const p of normalizeRows) {
      const row = {
        project_id: projectId,
        name: String(p.name || "").trim(),
        number:
          p.number != null && String(p.number).trim() !== ""
            ? String(p.number).trim()
            : null,
        planned_gen_date: normDate(p.plannedGenDate),
        planned_review_date: normDate(p.plannedReviewDate),
        planned_issue_date: normDate(p.plannedIssueDate),
      };

      if (row.number) {
        const existing = await knex("user_plans")
          .where({ project_id: projectId, number: row.number })
          .first();
        if (existing) {
          await knex("user_plans").where({ id: existing.id }).update({
            name: row.name,
            planned_gen_date: row.planned_gen_date,
            planned_review_date: row.planned_review_date,
            planned_issue_date: row.planned_issue_date,
            updated_at: knex.fn.now(),
          });
        } else {
          await knex("user_plans").insert({
            ...row,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
        }
      } else {
        await knex("user_plans").insert({
          ...row,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
      }
    }

    const rows = await knex("user_plans")
      .where({ project_id: projectId })
      .orderBy("id", "asc");

    res.json({ ok: true, plans: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al importar planes" });
  }
};

const updatePlan = async (req, res) => {
  try {
    await ensureTables(knex);

    const { projectId, id } = {
      projectId: req.params.projectId,
      id: Number(req.params.id),
    };
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
    };
    const patch = {};
    for (const k of Object.keys(req.body || {})) {
      if (k in allowed) {
        const dbKey = k
          .replace("plannedGenDate", "planned_gen_date")
          .replace("actualGenDate", "actual_gen_date")
          .replace("plannedReviewDate", "planned_review_date")
          .replace("actualReviewDate", "actual_review_date")
          .replace("plannedIssueDate", "planned_issue_date")
          .replace("actualIssueDate", "actual_issue_date")
          .replace("currentRevisionDate", "current_revision_date")
          .replace("currentRevision", "current_revision");
        patch[dbKey] = allowed[k](req.body[k]);
      }
    }
    if (!Object.keys(patch).length)
      return res.status(400).json({ error: "Nada que actualizar" });

    const exists = await knex("user_plans")
      .where({ id, project_id: projectId })
      .first();
    if (!exists) return res.status(404).json({ error: "Plan no encontrado" });

    patch.updated_at = knex.fn.now();
    await knex("user_plans").where({ id }).update(patch);
    const updated = await knex("user_plans").where({ id }).first();
    res.json({ ok: true, plan: updated });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al actualizar plan" });
  }
};

const deletePlan = async (req, res) => {
  try {
    await ensureTables(knex);

    const { projectId, id } = {
      projectId: req.params.projectId,
      id: Number(req.params.id),
    };
    await knex("user_plans").where({ id, project_id: projectId }).del();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al eliminar plan" });
  }
};

/* ----------------- MATCH: AEC (modelos) + ACC (folder) ----------------- */
const matchPlans = async (req, res) => {
  try {
    const { fetchReviewById } = require("../../libs/acc/acc.get.review.by.id.js");
    const { fetchProjectSheets } = require("../../libs/acc/acc.get.project.sheets.js");

    const projectId = req.params.projectId;
    const token = req.cookies["access_token"];
    const altProjectId = req.headers["x-alt-project-id"];  // 'b.xxx' o URN
    const selectedFolderId = req.headers["selected-folder-id"];

    if (!token) return res.status(401).json({ error: "Unauthorized" });
    if (!altProjectId || !selectedFolderId) {
      return res.status(400).json({
        error: "Missing folder selection",
        message: "Debes enviar headers: x-alt-project-id y selected-folder-id (folder de publicación).",
      });
    }

    // DM -> b.<guid>, Reviews -> GUID “pelón”
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

    // columnas opcionales
    const [canWriteApproval, canWriteActualReview, canWriteStatus] = await Promise.all([
      knex.schema.hasColumn("user_plans", "has_approval_flow").catch(() => false),
      knex.schema.hasColumn("user_plans", "actual_review_date").catch(() => false),
      knex.schema.hasColumn("user_plans", "status").catch(() => false),
    ]);

    // 1) Planes de usuario
    const plans = await knex("user_plans").where({ project_id: projectId });

    // 2) Modelos seleccionados
    const selectedRows = await knex("model_selection").where({ project_id: projectId }).select("model_id");
    const modelIds = selectedRows.map((r) => r.model_id);
    if (!modelIds.length) return res.status(400).json({ error: "No models selected for this project" });

    // 3) Sheets por modelo (AEC GraphQL)
    const allSheets = [];
    for (const modelId of modelIds) {
      try {
        const ss = await fetchSheets(token, modelId, "property.name.category==Sheets");
        for (const s of ss) allSheets.push(extractSheetFields(s));
      } catch (e) {
        console.warn("fetchSheets failed", modelId, e?.message || e);
      }
    }
    const byNumber = new Map();
    const byName = new Map();
    for (const s of allSheets) {
      if (s.number) byNumber.set(keyifyNumber(s.number), s);
      if (s.name) byName.set(keyifyName(s.name), s);
    }

    // 4) Contenidos del folder (ACC Docs)
    const files = await fetchFolderContents(token, altProjectId, selectedFolderId);

    const v1ByFileBase = new Map();
    const v1ByLeadingNumber = new Map();
    const tipVersionByFileBase = new Map();
    const tipVersionByLeadingNumber = new Map();
    const itemIdByFileBase = new Map();
    const itemIdByLeadingNumber = new Map();

    for (const f of files || []) {
      if (f?.type !== "items") continue;

      const displayName =
        f?.attributes?.displayName ||
        f?.attributes?.name ||
        f?.attributes?.fileName ||
        "";

      const v1Date = getV1DateFromInclVersions(f);     // ~createTime del item
      const tipVersionId = f?.relationships?.tip?.data?.id || null;
      const itemId = f?.id || null;

      const base = normalizeFileBase(displayName);
      const lead = getLeadingSheetNumber(displayName);

      if (v1Date && base) v1ByFileBase.set(keyifyName(base), v1Date);
      if (v1Date && lead) v1ByLeadingNumber.set(keyifyNumber(lead), v1Date);

      if (tipVersionId && base) tipVersionByFileBase.set(keyifyName(base), tipVersionId);
      if (tipVersionId && lead) tipVersionByLeadingNumber.set(keyifyNumber(lead), tipVersionId);

      if (itemId && base) itemIdByFileBase.set(keyifyName(base), itemId);
      if (itemId && lead) itemIdByLeadingNumber.set(keyifyNumber(lead), itemId);
    }

    // Helper: versiones de un item (fallback)
    const fetchItemVersions = async (itemId) => {
      try {
        const url = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(bProjectId)}/items/${encodeURIComponent(itemId)}/versions`;
        const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        return Array.isArray(data?.data) ? data.data : [];
      } catch (e) {
        console.warn("fetchItemVersions failed", itemId, e?.message || e);
        return [];
      }
    };

    // === NUEVO: traer Sheets de ACC Reviews para “Emisión real”
    let projectSheets = [];
    try {
      projectSheets = await fetchProjectSheets(token, accProjectGuid, 200);
    } catch (err) {
      console.warn(
        "fetchProjectSheets failed",
        err?.response?.status || "",
        err?.message || err
      );
      projectSheets = [];
    }
    const currentSheetsByNum = new Map();
    for (const sh of projectSheets) {
      if (!sh?.isCurrent) continue;
      const k = keyifyNumber(sh.number);
      if (!k) continue;
      const prev = currentSheetsByNum.get(k);
      if (!prev || new Date(sh.createdAt) > new Date(prev.createdAt)) {
        currentSheetsByNum.set(k, sh);
      }
    }

    console.log ("Sheets", projectSheets)

    // Mapeo de status
    const mapApprovalStatus = (value, label) => {
      const v = String(value || "").toUpperCase().trim();
      const l = String(label || "").toLowerCase();
      if (["APPROVED", "REJECTED", "IN_REVIEW", "NOT_IN_REVIEW"].includes(v)) return v;
      if (v === "A") return "APPROVED";
      if (v === "R") return "REJECTED";
      if (v === "I") return "IN_REVIEW";
      if (v === "NIR") return "NOT_IN_REVIEW";
      if (v === "W") return "APPROVED"; // tu payload
      if (l.includes("aprob")) return "APPROVED";
      if (l.includes("rechaz")) return "REJECTED";
      if (l.includes("review") || l.includes("revisi")) return "IN_REVIEW";
      return v || "IN_REVIEW";
    };

    const patches = [];
    const details = [];

    for (const p of plans) {
      const kNum = keyifyNumber(p.number);
      const kName = keyifyName(p.name);
      const kNum_fromNameField = keyifyNumber(p.name);
      const kName_fromNumberField = keyifyName(p.number);

      // --- MATCH modelos
      let hit = null;
      let matchedBy = null;
      if (kNum && byNumber.has(kNum)) { hit = byNumber.get(kNum); matchedBy = "model-number"; }
      else if (kName && byName.has(kName)) { hit = byName.get(kName); matchedBy = "model-name"; }
      else if (kNum_fromNameField && byNumber.has(kNum_fromNameField)) { hit = byNumber.get(kNum_fromNameField); matchedBy = "model-number (from-name-field)"; }
      else if (kName_fromNumberField && byName.has(kName_fromNumberField)) { hit = byName.get(kName_fromNumberField); matchedBy = "model-name (from-number-field)"; }

      // --- MATCH Docs
      let v1 = null;
      let tipVersionId = null;
      let itemId = null;
      let docsMatchedBy = null;

      if (!v1 && kNum && v1ByLeadingNumber.has(kNum)) { v1 = v1ByLeadingNumber.get(kNum); docsMatchedBy = "file-leading-number"; }
      if (!v1 && kNum_fromNameField && v1ByLeadingNumber.has(kNum_fromNameField)) { v1 = v1ByLeadingNumber.get(kNum_fromNameField); docsMatchedBy = "file-leading-number (from-name-field)"; }
      if (!v1 && kName && v1ByFileBase.has(kName)) { v1 = v1ByFileBase.get(kName); docsMatchedBy = "file-base-name"; }
      if (!v1 && kName_fromNumberField && v1ByFileBase.has(kName_fromNumberField)) { v1 = v1ByFileBase.get(kName_fromNumberField); docsMatchedBy = "file-base-name (from-number-field)"; }

      if (!tipVersionId && kNum && tipVersionByLeadingNumber.has(kNum)) tipVersionId = tipVersionByLeadingNumber.get(kNum);
      if (!tipVersionId && kNum_fromNameField && tipVersionByLeadingNumber.has(kNum_fromNameField)) tipVersionId = tipVersionByLeadingNumber.get(kNum_fromNameField);
      if (!tipVersionId && kName && tipVersionByFileBase.has(kName)) tipVersionId = tipVersionByFileBase.get(kName);
      if (!tipVersionId && kName_fromNumberField && tipVersionByFileBase.has(kName_fromNumberField)) tipVersionId = tipVersionByFileBase.get(kName_fromNumberField);

      if (!itemId && kNum && itemIdByLeadingNumber.has(kNum)) itemId = itemIdByLeadingNumber.get(kNum);
      if (!itemId && kNum_fromNameField && itemIdByLeadingNumber.has(kNum_fromNameField)) itemId = itemIdByLeadingNumber.get(kNum_fromNameField);
      if (!itemId && kName && itemIdByFileBase.has(kName)) itemId = itemIdByFileBase.get(kName);
      if (!itemId && kName_fromNumberField && itemIdByFileBase.has(kName_fromNumberField)) itemId = itemIdByFileBase.get(kName_fromNumberField);

      // --- Flujo de aprobación
      let hasApprovalFlow = false;
      let approval = null;

      if (tipVersionId) {
        try {
          const results = await fetchVersionApprovalStatuses(token, altProjectId, tipVersionId);
          if (Array.isArray(results) && results.length > 0) {
            hasApprovalFlow = true;
            const last = results[results.length - 1];
            const statusValue = mapApprovalStatus(last?.approvalStatus?.value, last?.approvalStatus?.label);
            const reviewId = last?.review?.id || null;

            let stamp = null;
            if (reviewId) {
              const rev = await fetchReviewById(token, accProjectGuid, reviewId);
              stamp = rev?.createdAt || rev?.finishedAt || rev?.updatedAt || null;
            }
            approval = { status: statusValue, reviewId, updatedAt: stamp };
          }
        } catch (e) {
          if ((e?.response?.status || 0) !== 404) console.warn("approval-statuses failed", tipVersionId, e?.message || e);
        }
      }

      // Fallback a reviewState en versiones del item
      if (!hasApprovalFlow && itemId) {
        const versions = await fetchItemVersions(itemId);
        const ordered = [...versions].sort((A, B) => (B?.attributes?.versionNumber || 0) - (A?.attributes?.versionNumber || 0));
        for (const v of ordered) {
          const ext = v?.attributes?.extension?.data || {};
          const state = ext.reviewState || ext.review_state || null;
          if (state && state !== "NOT_IN_REVIEW") {
            hasApprovalFlow = true;
            const t = v?.attributes?.lastModifiedTime || v?.attributes?.createTime || null;
            approval = { status: state, reviewId: null, updatedAt: t };
            break;
          }
        }
      }

      // --- Emisión a construcción (real) desde Sheets (ACC Reviews)
      let issueRealDate = null;
      let sheetMatchedBy = null;
      if (kNum && currentSheetsByNum.has(kNum)) {
        issueRealDate = currentSheetsByNum.get(kNum)?.createdAt || null;
        sheetMatchedBy = "sheet-number";
      } else if (kNum_fromNameField && currentSheetsByNum.has(kNum_fromNameField)) {
        issueRealDate = currentSheetsByNum.get(kNum_fromNameField)?.createdAt || null;
        sheetMatchedBy = "sheet-number (from-name-field)";
      }

      // --- Patch DB
      const patch = {};
      if (hit) {
        if (hit.currentRevision !== undefined) patch.current_revision = hit.currentRevision;
        if (hit.currentRevisionDate) patch.current_revision_date = hit.currentRevisionDate;
      }
      if (v1) patch.actual_gen_date = v1;
      if (issueRealDate) patch.actual_issue_date = normDate(issueRealDate);

      if (canWriteApproval) patch.has_approval_flow = hasApprovalFlow ? 1 : 0;
      if (canWriteStatus && approval?.status) patch.status = approval.status;
      if (canWriteActualReview && approval?.updatedAt) patch.actual_review_date = normDate(approval.updatedAt);

      details.push({
        id: p.id,
        number: p.number,
        name: p.name,
        matchedBy,
        model: hit ? {
          number: hit.number, name: hit.name,
          currentRevision: hit.currentRevision ?? null,
          currentRevisionDate: hit.currentRevisionDate ?? null,
        } : null,
        docs: {
          v1Date: v1 || null,
          matchedBy: docsMatchedBy || null,
          tipVersionId: tipVersionId || null,
          itemId: itemId || null,
        },
        approvals: {
          hasApprovalFlow,
          status: approval?.status || null,
          reviewId: approval?.reviewId || null,
          createdAt: approval?.updatedAt || null,
        },
        issue: {
          matchedBy: sheetMatchedBy,
          createdAt: issueRealDate || null,
        },
      });

      if (Object.keys(patch).length) {
        patch.updated_at = knex.fn.now();
        patches.push({ id: p.id, patch });
      }
    }

    if (patches.length) {
      await knex.transaction(async (trx) => {
        for (const { id, patch } of patches) {
          await trx("user_plans").where({ id }).update(patch);
        }
      });
    }

    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      matchedPlans: patches.length,
      totalPlans: plans.length,
      details,
      message:
        "Se actualizaron current_revision/current_revision_date, actual_gen_date (V1), flujo de aprobación (Reviews) y emisión real (Sheets.createdAt).",
    });
  } catch (e) {
    console.error("matchPlans error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "Match failed" });
  }
};


module.exports = {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
};
