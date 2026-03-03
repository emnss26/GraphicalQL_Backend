const knex = require("../../../utils/db/knex");
const { ensureTables } = require("../../../utils/db/ensureTables");

const normDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const toNullableInt = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toText = (v) => String(v || "").trim();

const parseWeekPayload = (raw = {}, fallbackWeekKey = null) => {
  const weekKey = normDate(
    fallbackWeekKey ||
    raw.weekKey ||
    raw.week_key ||
    raw.weekStart ||
    raw.week_start
  );

  if (!weekKey) {
    const err = new Error("weekKey invalido. Usa formato YYYY-MM-DD.");
    err.status = 400;
    err.code = "ValidationError";
    throw err;
  }

  return {
    weekKey,
    trackingWeek: toNullableInt(raw.trackingWeek ?? raw.tracking_week ?? raw.weekNumber ?? raw.week_number),
    weekEnd: normDate(raw.weekEnd ?? raw.week_end ?? raw.weekEndDate ?? raw.week_end_date),
    restriction: toText(raw.restriction ?? raw.restrictions ?? raw.restrictionText ?? raw.restriction_text),
  };
};

const toTrackingDto = (row) => ({
  id: row.id,
  projectId: row.project_id,
  weekKey: normDate(row.week_key),
  trackingWeek: row.tracking_week,
  weekEnd: normDate(row.week_end),
  restriction: row.restriction || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function upsertTrackingInTrx(trx, projectId, payload, fallbackWeekKey = null) {
  const parsed = parseWeekPayload(payload, fallbackWeekKey);

  const existing = await trx("plan_tracking_restrictions")
    .where({ project_id: projectId, week_key: parsed.weekKey })
    .first();

  if (!parsed.restriction) {
    if (existing) {
      await trx("plan_tracking_restrictions").where({ id: existing.id }).del();
      return { action: "deleted", weekKey: parsed.weekKey, row: null };
    }
    return { action: "noop", weekKey: parsed.weekKey, row: null };
  }

  const rowPatch = {
    tracking_week: parsed.trackingWeek,
    week_end: parsed.weekEnd,
    restriction: parsed.restriction,
    updated_at: knex.fn.now(),
  };

  if (existing) {
    await trx("plan_tracking_restrictions").where({ id: existing.id }).update(rowPatch);
    const updated = await trx("plan_tracking_restrictions").where({ id: existing.id }).first();
    return { action: "updated", weekKey: parsed.weekKey, row: updated };
  }

  const insertPayload = {
    project_id: projectId,
    week_key: parsed.weekKey,
    ...rowPatch,
    created_at: knex.fn.now(),
  };
  await trx("plan_tracking_restrictions").insert(insertPayload);
  const created = await trx("plan_tracking_restrictions")
    .where({ project_id: projectId, week_key: parsed.weekKey })
    .first();
  return { action: "created", weekKey: parsed.weekKey, row: created };
}

const listTrackingRestrictions = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const rows = await knex("plan_tracking_restrictions")
      .where({ project_id: projectId })
      .orderBy("week_key", "asc");

    return res.json({
      success: true,
      message: "Restricciones semanales listadas",
      data: { restrictions: rows.map(toTrackingDto) },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "TrackingRestrictionsListError";
    return next(err);
  }
};

const upsertTrackingRestriction = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const weekKey = req.params.weekKey;

    const result = await knex.transaction((trx) => upsertTrackingInTrx(trx, projectId, req.body || {}, weekKey));

    return res.json({
      success: true,
      message: "Restriccion semanal guardada",
      data: {
        action: result.action,
        weekKey: result.weekKey,
        restriction: result.row ? toTrackingDto(result.row) : null,
      },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "TrackingRestrictionUpsertError";
    return next(err);
  }
};

const bulkUpsertTrackingRestrictions = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const restrictions = Array.isArray(req.body?.restrictions) ? req.body.restrictions : null;

    if (!restrictions) {
      const err = new Error("Payload invalido. Se esperaba restrictions[].");
      err.status = 400;
      err.code = "ValidationError";
      return next(err);
    }

    const actions = [];
    await knex.transaction(async (trx) => {
      for (const item of restrictions) {
        const r = await upsertTrackingInTrx(trx, projectId, item || {});
        actions.push({ action: r.action, weekKey: r.weekKey });
      }
    });

    const rows = await knex("plan_tracking_restrictions")
      .where({ project_id: projectId })
      .orderBy("week_key", "asc");

    return res.json({
      success: true,
      message: "Restricciones semanales actualizadas",
      data: { actions, restrictions: rows.map(toTrackingDto) },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "TrackingRestrictionsBulkUpsertError";
    return next(err);
  }
};

const parseCommentPayload = (raw = {}) => {
  const planId = toNullableInt(raw.planId ?? raw.plan_id);
  const planNumber = toText(raw.planNumber ?? raw.plan_number) || null;
  const planName = toText(raw.planName ?? raw.plan_name);
  const comment = toText(raw.comment ?? raw.comments ?? raw.controlComment ?? raw.control_comment);

  if (!planId && !planNumber && !planName) {
    const err = new Error("Debe enviarse planId, planNumber o planName.");
    err.status = 400;
    err.code = "ValidationError";
    throw err;
  }

  return { planId, planNumber, planName, comment };
};

const buildControlLookup = (projectId, parsed) => {
  if (parsed.planId) return { project_id: projectId, plan_id: parsed.planId };
  if (parsed.planNumber) return { project_id: projectId, plan_number: parsed.planNumber };
  return { project_id: projectId, plan_name: parsed.planName };
};

const toControlDto = (row) => ({
  id: row.id,
  projectId: row.project_id,
  planId: row.plan_id,
  planNumber: row.plan_number,
  planName: row.plan_name,
  comment: row.comment || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function upsertControlCommentInTrx(trx, projectId, payload) {
  const parsed = parseCommentPayload(payload);
  const lookup = buildControlLookup(projectId, parsed);

  const existing = await trx("plan_control_comments").where(lookup).first();

  if (!parsed.comment) {
    if (existing) {
      await trx("plan_control_comments").where({ id: existing.id }).del();
      return { action: "deleted", key: lookup, row: null };
    }
    return { action: "noop", key: lookup, row: null };
  }

  const patch = {
    plan_id: parsed.planId,
    plan_number: parsed.planNumber,
    plan_name: parsed.planName || parsed.planNumber || "",
    comment: parsed.comment,
    updated_at: knex.fn.now(),
  };

  if (existing) {
    await trx("plan_control_comments").where({ id: existing.id }).update(patch);
    const updated = await trx("plan_control_comments").where({ id: existing.id }).first();
    return { action: "updated", key: lookup, row: updated };
  }

  await trx("plan_control_comments").insert({
    project_id: projectId,
    ...patch,
    created_at: knex.fn.now(),
  });

  const created = await trx("plan_control_comments").where(lookup).first();
  return { action: "created", key: lookup, row: created };
}

const listControlComments = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const rows = await knex("plan_control_comments")
      .where({ project_id: projectId })
      .orderBy("plan_number", "asc")
      .orderBy("plan_name", "asc");

    return res.json({
      success: true,
      message: "Comentarios de control listados",
      data: { comments: rows.map(toControlDto) },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "ControlCommentsListError";
    return next(err);
  }
};

const upsertControlComment = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const result = await knex.transaction((trx) => upsertControlCommentInTrx(trx, projectId, req.body || {}));

    return res.json({
      success: true,
      message: "Comentario de control guardado",
      data: {
        action: result.action,
        comment: result.row ? toControlDto(result.row) : null,
      },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "ControlCommentUpsertError";
    return next(err);
  }
};

const bulkUpsertControlComments = async (req, res, next) => {
  try {
    await ensureTables(knex);
    const projectId = req.params.projectId;
    const comments = Array.isArray(req.body?.comments) ? req.body.comments : null;

    if (!comments) {
      const err = new Error("Payload invalido. Se esperaba comments[].");
      err.status = 400;
      err.code = "ValidationError";
      return next(err);
    }

    const actions = [];
    await knex.transaction(async (trx) => {
      for (const item of comments) {
        const r = await upsertControlCommentInTrx(trx, projectId, item || {});
        actions.push({ action: r.action });
      }
    });

    const rows = await knex("plan_control_comments")
      .where({ project_id: projectId })
      .orderBy("plan_number", "asc")
      .orderBy("plan_name", "asc");

    return res.json({
      success: true,
      message: "Comentarios de control actualizados",
      data: { actions, comments: rows.map(toControlDto) },
      error: null,
    });
  } catch (err) {
    err.code = err.code || "ControlCommentsBulkUpsertError";
    return next(err);
  }
};

module.exports = {
  listTrackingRestrictions,
  upsertTrackingRestriction,
  bulkUpsertTrackingRestrictions,
  listControlComments,
  upsertControlComment,
  bulkUpsertControlComments,
};
