const knex = require("knex")(require("../../../knexfile").development);

const normDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const listPlans = async (req, res) => {
  try {
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
    const projectId = req.params.projectId;
    const { plans = [] } = req.body || {};
    if (!Array.isArray(plans) || !plans.length) {
      return res.status(400).json({ error: "Payload vacío" });
    }

    for (const p of plans) {
      const row = {
        project_id: projectId,
        name: String(p.name || "").trim(),
        number: (p.number != null && String(p.number).trim() !== "") ? String(p.number).trim() : null,
        planned_gen_date: normDate(p.plannedGenDate),
        planned_review_date: normDate(p.plannedReviewDate),
        planned_issue_date: normDate(p.plannedIssueDate),
      };

      if (row.number) {
        // UPSERT por (project_id, number)
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
        // SIN número → SIEMPRE inserta una nueva fila
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
    const { projectId, id } = { projectId: req.params.projectId, id: Number(req.params.id) };
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
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nada que actualizar" });

    const exists = await knex("user_plans").where({ id, project_id: projectId }).first();
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
    const { projectId, id } = { projectId: req.params.projectId, id: Number(req.params.id) };
    await knex("user_plans").where({ id, project_id: projectId }).del();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al eliminar plan" });
  }
};

const matchPlansStub = async (req, res) => {
  // Mañana: aquí llenamos current_revision, current_revision_date, actual_gen_date, actual_review_date, actual_issue_date, status
  res.json({ ok: true, message: "Match pendiente de implementación" });
};

module.exports = { listPlans, importPlans, updatePlan, deletePlan, matchPlansStub };