// resources/controllers/plans/aec.project.plans.controller.js

const knex = require("knex")(require("../../../knexfile").development)
const axios = require("axios")

const { ensureTables } = require("../../../utils/db/ensureTables")
const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js")
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js")
const { fetchVersionApprovalStatuses } = require("../../libs/acc/acc.get.version.approvals.js")
const { fetchReviewById } = require("../../libs/acc/acc.get.review.by.id.js")
const { fetchProjectSheets } = require("../../libs/acc/acc.get.project.sheets.js")

/* ----------------------------- Date helpers ----------------------------- */
const normDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/* ----------------------------- Text helpers ----------------------------- */
const normalizeText = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()

/**
 * Phase 2 normalization:
 * - Strip ".pdf" before building match keys
 * - Keep hyphens in sheet numbers to avoid false positives
 */
const stripPdfExtension = (v) => String(v || "").trim().replace(/\.pdf$/i, "")

const keyifyNumber = (v) => {
  const s = normalizeText(stripPdfExtension(v))
  if (!s) return ""
  return s
    .replace(/\s+/g, "") // remove spaces
    .replace(/[^A-Z0-9-]/g, "") // keep hyphens
}

const keyifyName = (v) => {
  const s = normalizeText(v)
  if (!s) return ""
  return s.replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

/* -------------------- AEC GraphQL sheet field helpers ------------------- */
function getPropValue(propsObj, propName) {
  try {
    const arr = propsObj?.results || []
    const hit = arr.find(
      (p) => String(p?.name || "").toLowerCase() === String(propName).toLowerCase()
    )
    return hit?.value ?? null
  } catch {
    return null
  }
}

function dmyToISO(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (!m) return null

  let [, dd, mm, yy] = m
  const d = parseInt(dd, 10)
  const mo = parseInt(mm, 10) - 1
  let y = parseInt(yy, 10)
  if (y < 100) y = 2000 + y

  const dt = new Date(Date.UTC(y, mo, d))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

function extractSheetFields(s) {
  const props = s?.properties || {}
  const number = getPropValue(props, "Sheet Number")
  const name = getPropValue(props, "Sheet Name")
  const rev = getPropValue(props, "Current Revision")
  const revDateRaw = getPropValue(props, "Current Revision Date")

  const revDate = revDateRaw ? dmyToISO(revDateRaw) || normDate(revDateRaw) : null

  return {
    number: number ? String(number).trim() : "",
    name: name ? String(name).trim() : "",
    currentRevision: rev !== undefined && rev !== null ? String(rev) : "",
    currentRevisionDate: revDate,
  }
}

/* ----------------------------- Docs helpers ----------------------------- */
function normalizeFileBase(displayName) {
  const s = normalizeText(stripPdfExtension(displayName))
  // Keep extension stripping generic for file-base matching (name-based matching only).
  return s.replace(/\.[A-Z0-9]+$/, "").trim()
}

function getLeadingSheetNumber(displayName) {
  const s = normalizeText(stripPdfExtension(displayName))
  const m = s.match(/^([A-Z0-9-]+)/) // keep hyphens
  return m ? m[1] : null
}

function getV1DateFromInclVersions(item) {
  const ct = item?.attributes?.createTime
  return normDate(ct)
}

/* ------------------------------- ID helpers ------------------------------ */
const toBProject = (pid) => {
  const s = String(pid || "")
  if (s.startsWith("b.")) return s
  const m = s.match(/[0-9a-fA-F-]{36}/)
  return m ? `b.${m[0]}` : s
}

const toGuid = (pid) => {
  const s = String(pid || "")
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop()
  return s.replace(/^b\./i, "")
}

/* --------------------------------- CRUD --------------------------------- */
const listPlans = async (req, res, next) => {
  try {
    await ensureTables(knex)

    const rows = await knex("user_plans")
      .where({ project_id: req.params.projectId })
      .orderBy("id", "asc")

    return res.json({
      success: true,
      message: "Planes listados",
      data: { plans: Array.isArray(rows) ? rows : [] },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "PlanListError"
    return next(err)
  }
}

const importPlans = async (req, res, next) => {
  try {
    await ensureTables(knex)

    const projectId = req.params.projectId
    const { plans = [] } = req.body || {}

    if (!Array.isArray(plans) || plans.length === 0) {
      const err = new Error("Payload vacío")
      err.status = 400
      err.code = "ValidationError"
      return next(err)
    }

    // Detect swapped columns (name/number) for typical Excel imports.
    const looksLikeNumberToken = (s) => /^[a-zA-Z0-9_.-]+$/.test(String(s || "").trim())

    const normalized = plans.map((p) => {
      let name = String(p.name || "").trim()
      let number = String(p.number || "").trim()

      const nameIsToken = looksLikeNumberToken(name) && !/\s/.test(name)
      const numberLooksLikeName = /\s/.test(number) || /[a-záéíóúñ]/i.test(number)

      if (nameIsToken && numberLooksLikeName) {
        const tmp = name
        name = number
        number = tmp
      }

      return {
        name,
        number,
        plannedGenDate: p.plannedGenDate,
        plannedReviewDate: p.plannedReviewDate,
        plannedIssueDate: p.plannedIssueDate,
      }
    })

    await knex.transaction(async (trx) => {
      for (const p of normalized) {
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
        }

        if (row.number) {
          const existing = await trx("user_plans")
            .where({ project_id: projectId, number: row.number })
            .first()

          if (existing) {
            await trx("user_plans")
              .where({ id: existing.id })
              .update({
                name: row.name,
                planned_gen_date: row.planned_gen_date,
                planned_review_date: row.planned_review_date,
                planned_issue_date: row.planned_issue_date,
                updated_at: knex.fn.now(),
              })
          } else {
            await trx("user_plans").insert({
              ...row,
              created_at: knex.fn.now(),
              updated_at: knex.fn.now(),
            })
          }
        } else {
          await trx("user_plans").insert({
            ...row,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          })
        }
      }
    })

    const rows = await knex("user_plans")
      .where({ project_id: projectId })
      .orderBy("id", "asc")

    return res.json({
      success: true,
      message: "Planes importados",
      data: { plans: rows },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "PlanImportError"
    return next(err)
  }
}

const updatePlan = async (req, res, next) => {
  try {
    await ensureTables(knex)

    const projectId = req.params.projectId
    const id = Number(req.params.id)

    const validators = {
      name: (v) => String(v || "").trim(),
      number: (v) => {
        const s = String(v || "").trim()
        return s === "" ? null : s
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
      docsVersion: (v) => (v === "" || v === null ? null : Number(v)),
      docsVersionDate: normDate,
      lastReviewDate: normDate,
      lastReviewStatus: (v) => String(v || "").trim(),
      issueUpdatedAt: normDate,
      issueVersionSetName: (v) => String(v || "").trim(),
      hasApprovalFlow: (v) => (v === true || v === "true" || v === 1 ? 1 : 0),
    }

    const fieldToDb = {
      plannedGenDate: "planned_gen_date",
      actualGenDate: "actual_gen_date",
      plannedReviewDate: "planned_review_date",
      actualReviewDate: "actual_review_date",
      plannedIssueDate: "planned_issue_date",
      actualIssueDate: "actual_issue_date",
      currentRevision: "current_revision",
      currentRevisionDate: "current_revision_date",
      docsVersion: "docs_version_number",
      docsVersionDate: "docs_last_modified",
      lastReviewDate: "latest_review_date",
      lastReviewStatus: "latest_review_status",
      issueUpdatedAt: "sheet_updated_at",
      issueVersionSetName: "sheet_version_set",
      hasApprovalFlow: "has_approval_flow",
    }

    const patch = {}
    for (const k of Object.keys(req.body || {})) {
      if (!(k in validators)) continue
      const dbKey = fieldToDb[k] || k
      patch[dbKey] = validators[k](req.body[k])
    }

    if (Object.keys(patch).length === 0) {
      const err = new Error("Nada que actualizar")
      err.status = 400
      err.code = "ValidationError"
      return next(err)
    }

    const exists = await knex("user_plans").where({ id, project_id: projectId }).first()
    if (!exists) {
      const err = new Error("Plan no encontrado")
      err.status = 404
      err.code = "NotFound"
      return next(err)
    }

    patch.updated_at = knex.fn.now()
    await knex("user_plans").where({ id }).update(patch)

    const updated = await knex("user_plans").where({ id }).first()
    return res.json({ success: true, message: "Plan actualizado", data: { plan: updated }, error: null })
  } catch (err) {
    err.code = err.code || "PlanUpdateError"
    return next(err)
  }
}

const deletePlan = async (req, res, next) => {
  try {
    await ensureTables(knex)

    const projectId = req.params.projectId
    const id = Number(req.params.id)

    await knex("user_plans").where({ id, project_id: projectId }).del()

    return res.json({ success: true, message: "Plan eliminado", data: null, error: null })
  } catch (err) {
    err.code = err.code || "PlanDeleteError"
    return next(err)
  }
}

/* -------------------------- Match/Sync controller ------------------------- */
const matchPlans = async (req, res, next) => {
  try {
    const projectId = req.params.projectId
    const token = req.cookies?.access_token
    const altProjectId = req.headers["x-alt-project-id"]
    const selectedFolderId = req.headers["selected-folder-id"]

    if (!token) {
      const err = new Error("Unauthorized")
      err.status = 401
      return next(err)
    }

    if (!altProjectId || !selectedFolderId) {
      const err = new Error("Faltan headers de selección.")
      err.status = 400
      return next(err)
    }

    await ensureTables(knex)

    const bProjectId = toBProject(altProjectId)
    const accProjectGuid = toGuid(altProjectId)

    const getSelectedModelIds = async () => {
      const selectedRows = await knex("model_selection")
        .where({ project_id: projectId })
        .select("model_id")
      return selectedRows.map((r) => r.model_id)
    }

    const getModelSheetsIndex = async (modelIds) => {
      const allSheets = []

      for (const modelId of modelIds) {
        try {
          const ss = await fetchSheets(token, modelId, "property.name.category==Sheets")
          for (const s of ss) allSheets.push(extractSheetFields(s))
        } catch (e) {
          console.warn("fetchSheets warn", modelId)
        }
      }

      const byNumber = new Map()
      const byName = new Map()

      for (const s of allSheets) {
        if (s.number) byNumber.set(keyifyNumber(s.number), s)
        if (s.name) byName.set(keyifyName(s.name), s)
      }

      return { byNumber, byName }
    }

    const getDocsIndex = async () => {
      const files = await fetchFolderContents(token, altProjectId, selectedFolderId)

      const v1ByLeadingNumber = new Map()
      const v1ByFileBase = new Map()
      const itemIdByLeadingNumber = new Map()
      const itemIdByFileBase = new Map()

      for (const f of files || []) {
        if (f?.type !== "items") continue

        const displayName = f?.attributes?.displayName || f?.attributes?.name || ""
        const v1Date = getV1DateFromInclVersions(f)
        const itemId = f?.id || null

        const base = normalizeFileBase(displayName)
        const lead = getLeadingSheetNumber(displayName)

        if (v1Date) {
          if (lead) v1ByLeadingNumber.set(keyifyNumber(lead), v1Date)
          if (base) v1ByFileBase.set(keyifyName(base), v1Date)
        }

        if (itemId) {
          if (lead) itemIdByLeadingNumber.set(keyifyNumber(lead), itemId)
          if (base) itemIdByFileBase.set(keyifyName(base), itemId)
        }
      }

      return { v1ByLeadingNumber, v1ByFileBase, itemIdByLeadingNumber, itemIdByFileBase }
    }

    const getCurrentAccSheetsIndex = async () => {
      let projectSheets = []
      try {
        projectSheets = await fetchProjectSheets(token, accProjectGuid, 200)
      } catch {
        projectSheets = []
      }

      const currentSheetsByNum = new Map()
      for (const sh of projectSheets) {
        if (!sh?.isCurrent) continue
        const k = keyifyNumber(sh.number)
        if (!k) continue

        const prev = currentSheetsByNum.get(k)
        if (!prev || new Date(sh.createdAt) > new Date(prev.createdAt)) {
          currentSheetsByNum.set(k, sh)
        }
      }

      return currentSheetsByNum
    }

    const fetchItemVersions = async (itemId) => {
      try {
        const url = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(
          bProjectId
        )}/items/${encodeURIComponent(itemId)}/versions`
        const { data } = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        return Array.isArray(data?.data) ? data.data : []
      } catch {
        return []
      }
    }

    const normalizeStatus = (val) => {
      const v = String(val || "").toUpperCase()
      if (v === "A" || v === "APPROVED" || v.includes("Aprobado")) return "APPROVED"
      if (v === "R" || v === "REJECTED" || v.includes("Rechazado")) return "REJECTED"
      if (v === "OPEN" || v === "IN_REVIEW" || v.includes("En revisión")) return "IN_REVIEW"
      return v || ""
    }

    const analyzeApprovalFlow = async (itemId, reviewCache) => {
      let everApproved = false
      let firstReviewDate = null
      let latestReviewStatus = null
      let latestReviewDate = null
      let lastVersionNumber = null
      let lastVersionDate = null

      const versions = await fetchItemVersions(itemId)
      const ascending = [...versions].sort(
        (a, b) => (a.attributes?.versionNumber || 0) - (b.attributes?.versionNumber || 0)
      )

      if (ascending.length > 0) {
        const tip = ascending[ascending.length - 1]
        lastVersionNumber = tip.attributes?.versionNumber
        lastVersionDate = tip.attributes?.lastModifiedTime || tip.attributes?.createTime
      }

      for (const ver of ascending) {
        const vId = ver.id
        try {
          const statuses = await fetchVersionApprovalStatuses(token, altProjectId, vId)
          if (!statuses || statuses.length === 0) continue

          const finalState = statuses[statuses.length - 1]
          const statusStr = normalizeStatus(
            finalState.approvalStatus?.value || finalState.approvalStatus?.label
          )

          if (statusStr === "APPROVED") everApproved = true

          let reviewDate = null
          const reviewId = finalState.review?.id
          if (reviewId) {
            if (reviewCache.has(reviewId)) {
              reviewDate = reviewCache.get(reviewId)
            } else {
              const r = await fetchReviewById(token, accProjectGuid, reviewId)
              reviewDate = r?.createdAt || null
              reviewCache.set(reviewId, reviewDate)
            }
          }

          if (reviewDate && !firstReviewDate) firstReviewDate = reviewDate
          latestReviewStatus = statusStr
          latestReviewDate = reviewDate
        } catch {
          // Ignore version-level failures (e.g., 404s)
        }
      }

      return {
        everApproved,
        firstReviewDate,
        latestReviewStatus,
        latestReviewDate,
        lastVersionNumber,
        lastVersionDate,
      }
    }

    const buildPatch = ({ modelHit, v1Date, approvals, matchedSheet }) => {
      const patch = {}

      if (modelHit) {
        if (modelHit.currentRevision) patch.current_revision = modelHit.currentRevision
        if (modelHit.currentRevisionDate) patch.current_revision_date = modelHit.currentRevisionDate
      }

      if (v1Date) patch.actual_gen_date = v1Date

      if (approvals?.lastVersionNumber) patch.docs_version_number = approvals.lastVersionNumber
      if (approvals?.lastVersionDate) patch.docs_last_modified = normDate(approvals.lastVersionDate)

      patch.has_approval_flow = approvals?.everApproved ? 1 : 0

      if (approvals?.firstReviewDate) patch.actual_review_date = normDate(approvals.firstReviewDate)
      if (approvals?.latestReviewStatus) patch.latest_review_status = approvals.latestReviewStatus
      if (approvals?.latestReviewDate) patch.latest_review_date = normDate(approvals.latestReviewDate)

      if (matchedSheet) {
        if (matchedSheet.createdAt) patch.actual_issue_date = normDate(matchedSheet.createdAt)
        if (matchedSheet.updatedAt) patch.sheet_updated_at = normDate(matchedSheet.updatedAt)
        if (matchedSheet.versionSet?.name) patch.sheet_version_set = matchedSheet.versionSet.name
      }

      if (Object.keys(patch).length > 0) patch.updated_at = knex.fn.now()
      return patch
    }

    // Load base data
    const plans = await knex("user_plans").where({ project_id: projectId })
    const modelIds = await getSelectedModelIds()

    const [{ byNumber, byName }, docsIndex, currentSheetsByNum] = await Promise.all([
      getModelSheetsIndex(modelIds),
      getDocsIndex(),
      getCurrentAccSheetsIndex(),
    ])

    const patches = []
    const details = []
    const reviewCache = new Map()

    const processPlan = async (p) => {
      const kNum = keyifyNumber(p.number)
      const kName = keyifyName(p.name)

      let modelHit = null
      if (kNum && byNumber.has(kNum)) modelHit = byNumber.get(kNum)
      else if (kName && byName.has(kName)) modelHit = byName.get(kName)

      let v1Date = null
      let itemId = null

      if (kNum && docsIndex.v1ByLeadingNumber.has(kNum)) v1Date = docsIndex.v1ByLeadingNumber.get(kNum)
      else if (kName && docsIndex.v1ByFileBase.has(kName)) v1Date = docsIndex.v1ByFileBase.get(kName)

      if (kNum && docsIndex.itemIdByLeadingNumber.has(kNum)) itemId = docsIndex.itemIdByLeadingNumber.get(kNum)
      else if (kName && docsIndex.itemIdByFileBase.has(kName)) itemId = docsIndex.itemIdByFileBase.get(kName)

      const matchedSheet = kNum && currentSheetsByNum.has(kNum) ? currentSheetsByNum.get(kNum) : null

      const approvals = itemId ? await analyzeApprovalFlow(itemId, reviewCache) : null
      const patch = buildPatch({ modelHit, v1Date, approvals, matchedSheet })

      if (Object.keys(patch).length === 0) return null

      return {
        id: p.id,
        patch,
        details: {
          id: p.id,
          key: kNum,
          everApproved: approvals?.everApproved || false,
          firstDate: approvals?.firstReviewDate || null,
          latest: approvals?.latestReviewStatus || null,
        },
      }
    }

    // Batch parallel execution to avoid API saturation
    const BATCH_SIZE = 5
    for (let i = 0; i < plans.length; i += BATCH_SIZE) {
      const batch = plans.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(batch.map((p) => processPlan(p)))

      for (const r of results) {
        if (!r) continue
        patches.push({ id: r.id, patch: r.patch })
        if (r.details) details.push(r.details)
      }
    }

    if (patches.length > 0) {
      await knex.transaction(async (trx) => {
        for (const { id, patch } of patches) {
          await trx("user_plans").where({ id }).update(patch)
        }
      })
    }

    return res.status(200).json({
      success: true,
      message: "Match completado (Optimizado con Lotes Paralelos).",
      data: { matchedPlans: patches.length, details },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "PlanMatchError"
    return next(err)
  }
}

module.exports = {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
  matchPlans,
}
