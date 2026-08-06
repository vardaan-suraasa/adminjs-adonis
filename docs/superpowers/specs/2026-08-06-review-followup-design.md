# Review Follow-up Design

## Goal

Finish the review follow-up for virtual filters, generic search, custom actions,
guard-aware `currentAdmin`, and attachment validation so the branch is correct
on the repository's supported SQLite test dialect and safe under model
inheritance and create/update flows.

## Scope

The implementation will address only defects verified while reviewing
`chirgjin/adminjs-adonis#20` and `vardaan-suraasa/adminjs-adonis#1`:

- literal `LIKE` searches must work for `%`, `_`, and the escape character;
- structurally empty virtual range filters must be skipped;
- a multi-guard middleware must return the user from the guard that actually
  authenticated;
- inherited virtual filters and actions must execute against the concrete model,
  and duplicate inherited names must not silently overwrite registrations;
- provider resource/action merging must have a documented, tested precedence;
- `$adminResourceOptions.actions` must accept partial built-in action overrides;
- attachment strings may preserve an existing file during update, but may not
  bypass required-file validation during create or by changing the URL;
- the test TypeScript project must compile.

Unrelated refactoring and new AdminJS features are out of scope.

## Design

### Literal `LIKE` predicates

Keep literal search semantics. Continue escaping backslash, `%`, and `_`, but
apply the pattern through a query-builder helper that emits:

```sql
?? LIKE ? ESCAPE ?
```

The column identifier, escaped `%value%` pattern, and single-character
backslash escape are parameterized. Both string-identifier filtering and
generic searchable columns use the same helper. SQLite-backed tests distinguish
literal metacharacter matches from wildcard matches.

### Virtual filter emptiness

Treat a scalar as empty when it is `''`, `null`, or `undefined`. Treat a range
object as empty only when every supplied bound is empty by the same definition.
A one-sided range remains meaningful and is forwarded unchanged. The resolver
continues to receive the raw AdminJS value.

### Guard selection

Adonis auth middleware makes the guard that authenticated the request the
authoritative `ctx.auth.defaultGuard`, and `ctx.auth.user` resolves against that
guard. When any configured plugin middleware is `auth` or begins with `auth:`,
return `ctx.auth.user` only when `ctx.auth.isAuthenticated` is true. This remains
correct for comma-separated guards and for multiple auth middleware entries,
without reparsing middleware text or calling `ctx.auth.use`.

If no auth middleware is configured, preserve the existing `ctx.auth.user`
fallback. If `ctx.auth` is absent, or configured auth middleware did not
authenticate the request, return `undefined`.

### Decorator inheritance and provider action construction

Store unbound static methods in `$adminFilters` and `$adminActions`. `BaseResource`
invokes filter resolvers with `.call(this.model, value)`. The provider binds
action handlers to the concrete model when constructing the AdminJS resource
definition. Therefore inherited metadata executes against the child model.

Registration checks inspect inherited metadata as well as direct metadata.
Redeclaring an inherited filter path or action name throws rather than silently
overwriting it. Distinct child registrations still clone metadata through
Lucid's `inherit` strategy and do not mutate the parent.

Extract the provider's model-to-resource-definition mapping into a small pure
function and test it directly. `$adminResourceOptions.actions` are merged first;
decorated actions take precedence. The decorator-only `override` authorization
flag is removed before AdminJS receives the action options.

`AdminResourceOptions.actions` uses a partial action option shape so built-in
configuration such as `{ delete: { isAccessible: false } }` does not require an
`actionType`.

### Attachment validation

`validateParams` receives an optional existing record. `create` calls it without
one; `update` passes the loaded record.

- Empty optional strings become `null`.
- Empty required strings remain in the file schema and fail validation.
- A non-empty string is skipped as an unchanged file only when an existing
  record is present and the submitted value equals that record's serialized
  attachment value.
- Non-empty strings during create, or changed URL strings during update, go
  through file validation and fail.
- Uploaded file objects retain the existing validation path.

## Error Handling

Invalid input continues to surface as AdminJS `ValidationError`. Decorator
collisions fail at class registration with model/path-specific errors. Missing
authenticated guards result in an undefined `currentAdmin`, matching the
existing no-auth behavior without selecting an incorrect user.

## Testing

Tests follow red-green TDD and cover:

- SQLite execution for literal `%`, `_`, and backslash generic searches;
- generated string-ID `LIKE ... ESCAPE` predicates;
- empty, one-sided, and populated virtual ranges;
- second-guard authentication and bare-auth fallback;
- parent/child filter and action binding, inherited duplicate rejection, and
  metadata isolation;
- provider option/action merging and decorator precedence;
- partial built-in action typing;
- required create, unchanged update, changed-URL update, optional clear, and
  required clear attachment behavior;
- the existing runtime suite, source TypeScript, test TypeScript, lint,
  formatting, build, and `git diff --check`.
