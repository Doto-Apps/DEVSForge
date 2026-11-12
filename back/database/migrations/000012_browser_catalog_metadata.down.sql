-- Restore the known catalogue fingerprints for the previous application version.
-- Modeling sources and model integration references are unchanged. Only known
-- released fingerprints are translated; an unknown/modified digest stays
-- protected by SyncIntegrations' immutable-version check.
UPDATE integrations AS installed
SET digest = changes.new_digest
FROM (VALUES
 ('xdevs-go', '1.0.0', 'ecd821553dff46da32fd1cade3f0457b2df997913db1df8e8c12cc2dd87b61f7', '89a2b353296f49e671d22d68ba4db7bf249f63df49e4adf72baad5154dd6c764'),
 ('xdevs-java', '1.0.0', 'c11394c289580e70cb657f791c33ad22e54e0acfd40e007bfde3321464a15aef', '956985756025b2bbe152b045283521db8148c19e3fd2b41d13466c3cff421011'),
 ('xdevs-python', '1.0.0', '94e942ca3b38588c22d301744ede5779bdc78119a6f70d0919f4b572d55d4201', '7593577eef0c128b779a3ecad1f62792ee2f8293bb27c732812f0595f9cfa144')
) AS changes(id, version, old_digest, new_digest)
WHERE installed.id = changes.id
  AND installed.version = changes.version
  AND installed.digest = changes.old_digest;
