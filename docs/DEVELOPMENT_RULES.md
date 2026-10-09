# DEVELOPMENT_RULES.md

Rules for every future Claude Code task on VIZAURA GLOBAL. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

1. Do not modify unrelated modules.
2. Read only the documentation relevant to the current task.
3. Do not scan the entire repository unnecessarily.
4. Preserve existing functionality.
5. Do not introduce dependencies without justification.
6. Follow existing architecture.
7. Do not move files without a reason.
8. Do not change database architecture casually.
9. Do not change authentication architecture without approval.
10. Do not bypass backend authorization.
11. Never trust client-provided price, total, role, permissions, inventory, or sensitive identifiers.
12. Validate input at API boundaries.
13. Keep secrets server-side.
14. Use TypeScript strictly.
15. Follow existing naming conventions.
16. Add tests appropriate to the module.
17. Update relevant documentation after meaningful architectural changes.
18. Update [MODULE_STATUS.md](MODULE_STATUS.md) after completing a module.
19. Update [CHANGELOG.md](CHANGELOG.md) after meaningful changes.
20. Keep [CURRENT_TASK.md](CURRENT_TASK.md) focused on the current task.
21. Never rebuild unrelated features during a task.
22. Do not replace working architecture merely for stylistic reasons.
23. Never execute a machine-wide or otherwise broad/destructive command (e.g. `taskkill /F /IM node.exe /T` or any other kill-all-processes-of-a-type command, a database DROP/RESET, a recursive delete, uninstalling a package, or a global machine configuration change) without asking the user first — even during routine verification/cleanup. Prefer stopping the specific process/PID this session started. If safe, specific identification isn't possible in the current shell, stop and ask the user rather than guessing broadly. If a command must be run by the user themselves, say exactly what to run and wait — never assume or claim it was run.

## Token-Efficiency Workflow

Before modifying code:
1. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
2. Read only the relevant domain documentation (`docs/modules/*.md`).
3. Read only the files required for the task.
4. Do not recursively inspect the entire repository unless absolutely necessary.
5. Do not reread unrelated modules.
6. Do not reproduce large existing files in responses.
7. Summarize changes instead of dumping code.
8. Keep documentation concise.
9. Update only the documentation affected by the current task.

When a task is completed:
- Update [MODULE_STATUS.md](MODULE_STATUS.md).
- Update [CURRENT_TASK.md](CURRENT_TASK.md).
- Update [CHANGELOG.md](CHANGELOG.md) if appropriate.
