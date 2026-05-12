-- Remove IRP multi-language coupled seed models inserted by 000009_seed_irp_multilanguage_models.up.sql.

DELETE FROM models
WHERE id IN (
    '51a60322-f042-4925-8850-ec3ca65ac59c',
    '5829f77b-450f-44ea-8d93-83cc2e7e27d6'
);

DELETE FROM libraries l
WHERE l.id = '8c338e54-04e2-4c13-b048-f405f8032368'
  AND NOT EXISTS (SELECT 1 FROM models m WHERE m.lib_id = l.id);
