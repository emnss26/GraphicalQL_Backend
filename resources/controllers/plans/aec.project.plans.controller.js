// resources/controllers/plans/aec.project.plans.controller.js
const knex = require("knex")(require("../../../knexfile").development);
const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js");
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const { ensureTables } = require("../../../utils/db/ensureTables");
const { fetchVersionApprovalStatuses } = require("../../libs/acc/acc.get.version.approvals.js");
const axios = require("axios");

/* ----------------------- Helpers de formato ----------------------- */
const normDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const upperNoAccents = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

const keyifyNumber = (s) => upperNoAccents(s).replace(/[^A-Z0-9]/g, "");
const keyifyName = (s) => upperNoAccents(s).replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const getPropValue = (propsObj, propName) => {
  return (propsObj?.results || []).find(
    (p) => String(p?.name || "").toLowerCase() === String(propName).toLowerCase()
  )?.value ?? null;
};

const dmyToISO = (s) => {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  let y = parseInt(yy, 10);
  if (y < 100) y = 2000 + y;
  const dt = new Date(Date.UTC(y, parseInt(mm, 10) - 1, parseInt(dd, 10)));
  return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
};

const extractSheetFields = (s) => {
  const props = s?.properties || {};
  const number = getPropValue(props, "Sheet Number");
  const name = getPropValue(props, "Sheet Name");
  const rev = getPropValue(props, "Current Revision");
  const revDateRaw = getPropValue(props, "Current Revision Date");
  const revDate = revDateRaw ? dmyToISO(revDateRaw) || normDate(revDateRaw) : null;

  return {
    number: number ? String(number).trim() : "",
    name: name ? String(name).trim() : "",
    currentRevision: rev != null ? String(rev) : "",
    currentRevisionDate: revDate,
  };
};

const normalizeFileBase = (displayName) => upperNoAccents(displayName).replace(/\.[A-Z0-9]+$/, "").trim();
const getLeadingSheetNumber = (displayName) => upperNoAccents(displayName).match(/^([A-Z0-9-]+)/)?.[1] || null;
const getV1DateFromInclVersions = (item) => normDate(item?.attributes?.createTime);

const listPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const rows = await knex("user_plans")
      .where({ project_id: req.params.projectId })
      .orderBy("id", "asc");
    res.json({ success: true, message: "Planes listados", data: { plans: rows }, error: null });
  } catch (err) {
    err.code = err.code || "PlanListError";
    return next(err);
  }
};

const importPlans = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const { projectId } = req.params;
    const { plans = [] } = req.body;

    if (!Array.isArray(plans) || !plans.length) {
      const error = new Error("Payload vacío");
      error.status = 400;
      error.code = "ValidationError";
      return next(error);
    }

    const looksLikeNumber = (s) => /^[A-Z0-9_.-]+$/.test(String(s || "").trim());

    const normalizeRows = plans.map((p) => {
      let name = String(p.name || "").trim();
      let number = String(p.number || "").trim();

      if (looksLikeNumber(name) && (!number || /[a-záéíóúñ\s]/i.test(number))) {
        [name, number] = [number, name];
      }
      return {
        name,
        number,
        planned_gen_date: normDate(p.plannedGenDate),
        planned_review_date: normDate(p.plannedReviewDate),
        planned_issue_date: normDate(p.plannedIssueDate),
      };
    });

    for (const row of normalizeRows) {
      const data = {
        project_id: projectId,
        name: row.name,
        number: row.number || null,
        planned_gen_date: row.planned_gen_date,
        planned_review_date: row.planned_review_date,
        planned_issue_date: row.planned_issue_date,
        updated_at: knex.fn.now(),
      };

      if (data.number) {
        const exists = await knex("user_plans").where({ project_id: projectId, number: data.number }).first();
        if (exists) {
          await knex("user_plans").where({ id: exists.id }).update(data);
          continue;
        }
      }
      await knex("user_plans").insert({ ...data, created_at: knex.fn.now() });
    }

    const rows = await knex("user_plans").where({ project_id: projectId }).orderBy("id", "asc");
    res.json({ success: true, message: "Planes importados", data: { plans: rows }, error: null });
  } catch (err) {
    err.code = err.code || "PlanImportError";
    return next(err);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const { id, projectId } = { id: Number(req.params.id), projectId: req.params.projectId };

    const allowed = {
      name: (v) => String(v || "").trim(),
      number: (v) => String(v || "").trim() || null,
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
    for (const key in allowed) {
      if (req.body[key] !== undefined) {
        const dbKey = key
          .replace("plannedGenDate", "planned_gen_date")
          .replace("actualGenDate", "actual_gen_date")
          .replace("plannedReviewDate", "planned_review_date")
          .replace("actualReviewDate", "actual_review_date")
          .replace("plannedIssueDate", "planned_issue_date")
          .replace("actualIssueDate", "actual_issue_date")
          .replace("currentRevision", "current_revision")
          .replace("currentRevisionDate", "current_revision_date");
        patch[dbKey] = allowed[key](req.body[key]);
      }
    }

    if (!Object.keys(patch).length) {
      const error = new Error("Nada que actualizar");
      error.status = 400;
      error.code = "ValidationError";
      return next(error);
    }

    const exists = await knex("user_plans").where({ id, project_id: projectId }).first();
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
  } catch (err) {
    err.code = err.code || "PlanUpdateError";
    return next(err);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const { projectId, id } = { projectId: req.params.projectId, id: Number(req.params.id) };
    await knex("user_plans").where({ id, project_id: projectId }).del();
    res.json({ success: true, message: "Plan eliminado", data: null, error: null });
  } catch (err) {
    err.code = err.code || "PlanDeleteError";
    return next(err);
  }
};

module.exports = {
  listPlans,
  importPlans,
  updatePlan,
  deletePlan,
};
