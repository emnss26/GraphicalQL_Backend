const router = require("express").Router();
const db = require('knex')(require('../../../knexfile').development);


router.post("/aec/:projectId/plans/import", /*requireAuth,*/ async (req, res) => {
  try {
    const { projectId } = req.params;
    const { plans } = req.body;

    if (!Array.isArray(plans) || !plans.length) {
      return res.status(400).json({ error: "Payload inválido: 'plans' vacío." });
    }

    // Normaliza + filtra
    const rows = plans
      .map((p) => ({
        project_id: projectId,
        sheet_number: String(p.number || "").trim(),
        sheet_name: String(p.name || "").trim(),
      }))
      .filter((p) => p.sheet_number || p.sheet_name);

    if (!rows.length) {
      return res.status(400).json({ error: "No hay planos válidos para importar." });
    }

    // Transacción: (opcional) limpiar antes lo ya importado del proyecto
    await db.transaction(async (trx) => {
      await trx("plans").where({ project_id: projectId }).del();
      await trx.batchInsert("plans", rows, 100);
    });

    res.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno al importar planos." });
  }
});

module.exports = router;