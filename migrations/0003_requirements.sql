-- Requirement traceability. Tests carry tags such as "@REQ-3" (a GitHub issue number in wealthlite);
-- the dashboard matches them to the requirement issues. A run can also be filtered to a subset of tests.
ALTER TABLE test_results ADD COLUMN tags TEXT;
ALTER TABLE runs ADD COLUMN filter TEXT;
