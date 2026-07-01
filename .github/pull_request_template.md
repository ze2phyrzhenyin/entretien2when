## Summary

## Checks

- [ ] Read relevant PRD/ADR/docs
- [ ] UI quality gate if UI changed
- [ ] Auth/security guard if permissions or private data changed
- [ ] Database migration guard if schema/data access changed
- [ ] `pnpm check`

## Privacy Notes

- [ ] Candidate APIs do not expose other candidates
- [ ] Candidate APIs do not expose lock reasons or internal notes
- [ ] Candidate APIs do not expose admin private notes
