# Claude Instructions — Monarch → ProjectionLab Sync

## Version bumping

**Always increment the patch version in `manifest.json` before every `git commit` + push.**

- Version field: `manifest.json` → `"version"`
- Use semantic patch increments: `1.3.1` → `1.3.2` → `1.3.3`, etc.
- Minor version (`1.3` → `1.4`) for new features; patch (`1.3.x`) for fixes and small changes.
- Include a "Bump version to X.Y.Z" note in the commit message (or a separate commit).
