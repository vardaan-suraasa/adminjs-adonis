# Review Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the remaining verified defects in PR #1 and add regression coverage before pushing `fix/review-virtual-filters-search-actions`.

**Architecture:** Reuse the existing `BaseResource`, decorator metadata, router, and provider flow. Introduce only small helpers at the boundaries where behavior is currently ambiguous: literal SQL `LIKE`, empty filter values, concrete-model callback binding, provider resource construction, and operation-aware attachment validation.

**Tech Stack:** TypeScript 4.9, AdonisJS 5/Lucid 18, AdminJS 6, Japa 2, Sinon, Knex/SQLite, Yarn 1.

---

### Task 1: Make search predicates literal and skip empty ranges

**Files:**
- Modify: `src/Adapter/BaseResource.ts`
- Modify: `src/Adapter/helpers.ts`
- Modify: `tests/unit/src/Adapter/BaseResource.spec.ts`
- Modify: `tests/unit/src/Adapter/helpers.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add failing database-backed metacharacter tests**

Add generic-search cases that insert unique usernames containing `%`, `_`, and
`\`, execute the Lucid query, and prove each literal input matches only its
literal row rather than wildcard alternatives. Add a string-identifier SQL test
that expects `LIKE ? ESCAPE ?` with the escaped pattern and `\` binding.

- [ ] **Step 2: Run the focused tests and verify the LIKE cases fail**

Run:

```bash
yarn test tests/unit/src/Adapter/BaseResource.spec.ts
```

Expected: the new SQLite literal-match assertions fail because `whereLike`
does not emit an `ESCAPE` clause.

- [ ] **Step 3: Add failing virtual-range emptiness tests**

Add tests with these exact expectations:

```ts
{ 'createdRange~~from': '', 'createdRange~~to': '' } // resolver not called
{ 'createdRange~~from': '2020-01-01', 'createdRange~~to': '' } // raw object forwarded
```

Extend the populated range test to assert the resolver's returned
`whereBetween` callback appears in `query.toSQL()`.

- [ ] **Step 4: Run the focused tests and verify the empty-range case fails**

Run the same focused test command. Expected: the empty range invokes the
resolver before implementation.

- [ ] **Step 5: Implement a parameterized literal-LIKE helper**

Keep `escapeLikePattern(value)` and add a helper used by both filtering paths:

```ts
function applyLiteralLike(
    builder: ModelQueryBuilderContract<LucidModel>,
    column: string,
    value: string
) {
    builder.whereRaw('?? LIKE ? ESCAPE ?', [
        column,
        `%${escapeLikePattern(value)}%`,
        '\\',
    ])
}
```

Use it for string identifier filters and each generic searchable-column
callback. Do not interpolate identifiers or values into raw SQL.

- [ ] **Step 6: Implement structural empty-value detection**

Add a helper that returns true for scalar `''`/nullish values and for range
objects whose values are all empty. Use it before invoking a virtual resolver.
Do not skip a one-sided non-empty range.

- [ ] **Step 7: Update the search documentation**

Replace the “best-effort” wording with the explicit `ESCAPE` behavior and keep
the reservation guidance.

- [ ] **Step 8: Run focused tests and commit**

Run:

```bash
yarn test tests/unit/src/Adapter/BaseResource.spec.ts tests/unit/src/Adapter/helpers.spec.ts
```

Expected: all focused tests pass.

Commit:

```bash
git add src/Adapter/BaseResource.ts src/Adapter/helpers.ts tests/unit/src/Adapter/BaseResource.spec.ts tests/unit/src/Adapter/helpers.spec.ts README.md
git commit -m "fix: make admin search filters literal"
```

### Task 2: Use the guard selected by Adonis auth middleware

**Files:**
- Modify: `src/Plugin/router.ts`
- Modify: `tests/unit/src/Plugin/router.spec.ts`
- Modify: `templates/config.txt`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add failing authoritative-auth-state cases**

Model `ctx.auth.defaultGuard === 'api'`, `ctx.auth.user === apiUser`, and
`ctx.auth.isAuthenticated === true`. Cover both canonical `auth:web,api` and
multiple middleware entries such as `['auth:web', 'auth:api']`, where the later
middleware selected the authoritative guard. Assert `currentAdmin === apiUser`.
Retain cases for one explicit guard, bare `auth`, no matching middleware, absent
`ctx.auth`, and configured auth middleware that did not authenticate.

- [ ] **Step 2: Run the router tests and verify reparsing middleware fails**

Run:

```bash
yarn test --files="tests/unit/src/Plugin/router.spec.ts"
```

Expected: the old implementation calls `auth.use` or returns the user from an
earlier textual middleware entry instead of the authoritative `ctx.auth.user`.

- [ ] **Step 3: Trust the auth state finalized by Adonis middleware**

When any configured middleware is exactly `auth` or begins with `auth:`, return
`ctx.auth.user` only if `ctx.auth.isAuthenticated` is true; otherwise return
`undefined`. Do not parse guard names or call `ctx.auth.use`. When no auth
middleware is configured, preserve the existing `ctx.auth.user` fallback.
Absent `ctx.auth` returns `undefined`.

- [ ] **Step 4: Document the public behavior**

Update `templates/config.txt` and `CHANGELOG.md` to state that multi-guard
middleware resolves `currentAdmin` from the authenticated/default guard selected
by Adonis middleware.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
yarn test --files="tests/unit/src/Plugin/router.spec.ts"
```

Expected: all router tests pass.

Commit:

```bash
git add src/Plugin/router.ts tests/unit/src/Plugin/router.spec.ts templates/config.txt CHANGELOG.md docs/superpowers/specs/2026-08-06-review-followup-design.md docs/superpowers/plans/2026-08-06-review-followup.md
git commit -m "fix: trust Adonis authenticated guard"
```

### Task 3: Make decorator inheritance and provider merging safe

**Files:**
- Modify: `src/Adapter/decorators.ts`
- Modify: `src/Adapter/BaseResource.ts`
- Modify: `providers/AdminProvider.ts`
- Modify: `adonis-typings/adapter/decorator.ts`
- Modify: `adonis-typings/orm.ts`
- Modify: `tests/unit/src/Adapter/decorators.spec.ts`
- Create: `tests/unit/providers/AdminProvider.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add failing inheritance tests**

Create a decorated parent model and child model. Prove:

- an inherited filter resolver observes `this === Child` through
  `BaseResource.applyFilter`;
- an inherited action handler produced by the provider observes
  `this === Child`;
- redeclaring an inherited filter/action name throws;
- adding a distinct child filter/action leaves the parent metadata unchanged.

- [ ] **Step 2: Add failing provider merge and type tests**

Add provider tests for:

```ts
$adminResourceOptions.actions // merged first
$adminActions                 // decorator wins on same key
```

Assert the final handler is bound to the concrete model and the internal
`override` flag is absent. Add a compile-time-valid assignment:

```ts
const options: AdminResourceOptions = {
    actions: {
        delete: { isAccessible: false },
    },
}
```

- [ ] **Step 3: Run focused runtime and test-TypeScript checks**

Run:

```bash
yarn test tests/unit/src/Adapter/decorators.spec.ts tests/unit/providers/AdminProvider.spec.ts
yarn tsc -p tests/tsconfig.json --noEmit
```

Expected: inheritance/provider assertions fail and the resource action type
requires `actionType`. The existing two-argument Sinon assertion may also fail.

- [ ] **Step 4: Store unbound decorator methods and reject inherited duplicates**

Remove target-local WeakMap duplicate tracking. Before registering, inspect
existing inherited metadata for the same path/name. Store the original static
method without binding. Preserve the built-in action `override` authorization
check, but do not store that flag in the action passed downstream.

Invoke filter resolvers as:

```ts
virtualFilter.resolve.call(this.model, value)
```

in direct filters and generic search.

- [ ] **Step 5: Extract and use a provider resource-definition helper**

Create a pure exported helper in `providers/AdminProvider.ts` that returns:

```ts
{
    resource: model,
    options: {
        ...model.$adminResourceOptions,
        actions: {
            ...model.$adminResourceOptions?.actions,
            ...boundDecoratedActions,
        },
    },
}
```

Bind each decorated action handler to `model` while preserving the other action
options. Use this helper inside `register`.

- [ ] **Step 6: Relax resource-option action typing and fix test typing**

Change `AdminResourceOptions.actions` entries to
`Partial<ActionDecoratorOptions> & { handler?: ActionDecoratorHandler }`.
Fix the enum-filter Sinon assertion by checking the call count and arguments
without invoking a method signature that requires three parameters.

- [ ] **Step 7: Document merge precedence**

State that decorated actions override same-named
`$adminResourceOptions.actions`, and that inherited duplicate decorator names
are rejected.

- [ ] **Step 8: Run focused checks and commit**

Run:

```bash
yarn test tests/unit/src/Adapter/decorators.spec.ts tests/unit/providers/AdminProvider.spec.ts tests/unit/src/Adapter/BaseResource.spec.ts
yarn tsc -p tests/tsconfig.json --noEmit
```

Expected: focused runtime tests and test TypeScript pass.

Commit:

```bash
git add src/Adapter/decorators.ts src/Adapter/BaseResource.ts providers/AdminProvider.ts adonis-typings/adapter/decorator.ts adonis-typings/orm.ts tests/unit/src/Adapter/decorators.spec.ts tests/unit/providers/AdminProvider.spec.ts tests/unit/src/Adapter/BaseResource.spec.ts README.md
git commit -m "fix: bind admin metadata to concrete models"
```

### Task 4: Make attachment preservation operation-aware

**Files:**
- Modify: `src/Adapter/BaseResource.ts`
- Modify: `adonis-typings/adapter/Resource.ts`
- Modify: `tests/unit/src/Adapter/BaseResource.spec.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add failing create/update attachment tests**

Cover these behaviors:

- required create with a non-empty URL string throws `ValidationError`;
- update with the exact existing serialized URL omits the field from validated
  data and preserves it;
- update with a different URL string throws `ValidationError`;
- optional empty update merges `null` and saves;
- required empty update throws before merge/save.

Use real `validateParams` behavior; do not stub it in these regression cases.

- [ ] **Step 2: Run focused tests and verify the create bypass**

Run:

```bash
yarn test tests/unit/src/Adapter/BaseResource.spec.ts
```

Expected: required create with a non-empty string currently passes validation.

- [ ] **Step 3: Pass the existing record into validation**

Add an optional existing-record parameter to `validateParams`. `create` omits
it; `update` passes the loaded object. Build attachment schema entries using
these rules:

```ts
empty && optional                         => validated null
empty && required                         => file validation
nonEmptyString && equals existing output  => preserve/omit
otherwise                                 => file validation
```

Compare against the existing record's serialized attachment value so stored
objects and stored URL strings both work.

- [ ] **Step 4: Update declarations and changelog**

Reflect the optional existing record parameter in
`adonis-typings/adapter/Resource.ts` and document that arbitrary attachment
strings no longer bypass create/update validation.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
yarn test tests/unit/src/Adapter/BaseResource.spec.ts
```

Expected: all BaseResource tests pass.

Commit:

```bash
git add src/Adapter/BaseResource.ts adonis-typings/adapter/Resource.ts tests/unit/src/Adapter/BaseResource.spec.ts CHANGELOG.md
git commit -m "fix: validate attachment strings by operation"
```

### Task 5: Final verification

**Files:**
- Modify only if a verification failure reveals a defect within this plan.

- [ ] **Step 1: Run runtime tests**

```bash
yarn test
```

Expected: all tests pass.

- [ ] **Step 2: Run source and test TypeScript checks**

```bash
yarn tsc --noEmit
yarn tsc -p tests/tsconfig.json --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 3: Run non-mutating lint and formatting checks**

```bash
yarn eslint . --ext=.ts
yarn prettier --check .
```

Expected: zero lint errors and all files formatted.

- [ ] **Step 4: Build and inspect the diff**

```bash
yarn build
git diff --check fix/review-virtual-filters-search-actions...HEAD
git status --short
```

Expected: build succeeds, diff check is empty, and the worktree contains only
the planned committed changes.
