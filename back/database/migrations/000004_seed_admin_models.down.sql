-- Remove admin model seed inserted by 000004_seed_admin_models.up.sql.

DELETE FROM models WHERE id IN ('d5cf6d62-7884-4ed9-b03a-3d129a62014a', '604a54ad-bc31-4a94-917e-ebb49c488452', 'a4c1c8fe-5713-4e51-a53d-4192aac53c43', '3dd4d8e6-44e2-4050-9d84-4fb3af49fa04', '3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8', '331408a8-51e6-42b0-9185-f3ca3d4a4fc8', 'a638d6d9-2611-4526-b638-f03b2043742a');
DELETE FROM libraries l WHERE l.id IN ('bd9dd34b-9b4d-4b2d-929b-145b96435eef') AND NOT EXISTS (SELECT 1 FROM models m WHERE m.lib_id = l.id);
