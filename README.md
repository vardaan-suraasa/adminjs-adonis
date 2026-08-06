# Admin Js Adonis

Adapter & Plugin package to use [AdminJS](https://adminjs.co/) with [AdonisJS](https://adonisjs.com/).

## Getting Started

### Installation

```bash
# using npm:

npm install --save adminjs-adonis adminjs@^6.0.0

# or using yarn:
yarn add adminjs-adonis adminjs@^6.0.0
```

After this, run:
```bash
node ace configure adminjs-adonis
```

### Configuration

The configuration for this package resides in `config/adminjs.ts`. Checkout [templates/config.txt](templates/config.txt) for configuration options.

### Model Customization

This package aims to auto-detect correct types of most of model columns but there are still some cases where it fails (for example: Enums, Attachments, nullable types etc) due to limitations of reflect-metadata package.

For this purpose, there is a `@adminColumn` decorator which you can use to inform the adapter how exactly you want a particular column to be displayed (or not displayed at all).

```ts
// User.ts
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { adminColumn } from '@ioc:Adonis/Addons/AdminJS'

export enum UserType {
    STUDENT = 1,
    TEACHER = 2,
}

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    public username: string

    @column()
    @adminColumn({
        // password won't be visible on the list or show page
        visible: false
    })
    public password: string

    @column()
    @adminColumn({
        enum: UserType 
        // type will now be rendered as a select box
        // and will display the choices as text rather than numbers
    })
    public type: UserType

    @column()
    @adminColumn({
        // By default, `number | null` type is parsed as string
        type: "number",
        // By default, every field is required except the primary key
        optional: true,
    })
    public teachingNumber: number | null
}
```

For full options provided by adminColumn decorator, visit [here](./adonis-typings/adapter/decorator.ts#AdminColumnOptions)

### Hooks

This package also provides hooks for lifecycle management. These hooks are:

- beforeCreate
- beforeUpdate
- beforeDelete
- beforeFind
- beforeFetch
- afterCreate
- afterUpdate
- afterDelete
- afterFind
- afterFetch

They work the same as AdonisJS' hooks and when these hooks are called, corresponding AdonisJS hooks are also executed.
For example: when user is creating a new object, then the order of hooks is:
1. beforeCreate (of admin)
2. beforeCreate (of AdonisJS)
3. beforeSave (of AdonisJS)
4. afterCreate (of AdonisJS)
5. afterSave (of AdonisJS)
6. afterCreate (of admin)

Note: There is no `beforeSave` or `afterSave` hook in this package

Example:
```ts
// User.ts
import { beforeCreate, beforeUpdate } from '@ioc:Adonis/Addons/AdminJS'
import Hash from '@ioc:Adonis/Core/Hash'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    public username: string

    @column()
    public password: string

    @beforeCreate()
    @beforeUpdate()
    public static async setPasswordIfDirty(instance: User) {
        if (instance.$dirty.password) {
            instance.password = await Hash.make(instance.password)
        }
    }
}

```

### Resource Options

`config/adminjs.ts`'s `adminjs.resources` array is the standard AdminJS way to pass
per-resource `options` (`filterProperties`, `properties`, `actions`, etc. - see
[AdminJS's `ResourceOptions`](https://docs.adminjs.co/basics/resource#resourceoptions)),
but it requires you to opt out of this package's automatic model discovery
(`adapter.models`) and list every resource by hand.

As a shortcut, you can instead declare a static `$adminResourceOptions` field
directly on the model - it's merged into that resource's options automatically,
alongside anything registered via `@adminAction`, while every other model
still goes through normal auto-discovery:

```ts
// User.ts
import { AdminResourceOptions } from '@ioc:Adonis/Addons/AdminJS'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    public username: string

    public static $adminResourceOptions: AdminResourceOptions = {
        // only show these fields in the filter sidebar
        filterProperties: ['id', 'username'],
    }
}
```

This is the mechanism the sections below (virtual filters & the generic search
box) rely on to surface a non-column field in the UI.

> **Type it as `AdminResourceOptions` from `@ioc:Adonis/Addons/AdminJS`, not
> `Partial<ResourceOptions>` from `adminjs` directly.** This package's own
> `adminjs` devDependency and your app's installed `adminjs` are two separate
> copies (this matters especially in local dev via `yarn/npm link`), so if
> your app's version differs even slightly from this package's, TypeScript
> will see two structurally different `ResourceOptions` types and fail with a
> confusing error. `AdminResourceOptions` is a small, hand-written type
> covering just the fields this package merges in - it doesn't depend on
> whichever `adminjs` version either side happens to have installed. The same
> applies to `@adminAction`'s options (`ActionDecoratorOptions`, also
> hand-written for the same reason).

### Filtering

By default, filtering works out of the box for every `@column` - most columns
get an exact-match filter. **String identifier** fields (`property.isId()` with
type `string`, e.g. a UUID primary key or a string unique column treated as an
id) get a partial (`LIKE`) match instead. Numeric primary keys (the common case)
still use exact match. Date/datetime filters use a range (`from` / `to`).

#### Virtual & cross-table filters (`@adminFilter`)

Sometimes the value you want to filter by isn't a column on the resource
itself - eg. it lives on a related table, or needs to be computed. Use the
`@adminFilter` decorator to register a static resolver method as a virtual
filter:

```ts
// User.ts
import { adminFilter } from '@ioc:Adonis/Addons/AdminJS'
import {
    BaseModel,
    ModelQueryBuilderContract,
    column,
} from '@ioc:Adonis/Lucid/Orm'

import Profile from './Profile'

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    public profileId: number

    // registers a filter available under the "phoneNumber" path
    @adminFilter('phoneNumber', { type: 'string' })
    public static async filterByPhoneNumber(value: string) {
        const profiles = await Profile.query()
            .whereLike('phoneNumber', `%${value}%`)
            .select('id')

        // do any async work first, then return a *synchronous* callback that
        // mutates the query - see "Why does the resolver return a function?"
        // below for why this two-step shape matters.
        return (query: ModelQueryBuilderContract<typeof User>) => {
            query.whereIn(
                'profileId',
                profiles.map((profile) => profile.id)
            )
        }
    }
}
```

A virtual filter's path (`'phoneNumber'` above) doesn't correspond to a real
column, so AdminJS won't show it in the filter sidebar automatically - it needs
an entry in `properties` before it'll appear (AdminJS only creates a virtual UI
property for paths that show up there), added via
[`$adminResourceOptions`](#resource-options):

```ts
public static $adminResourceOptions: AdminResourceOptions = {
    properties: {
        // scope it to the filter view only - it isn't a real field, so it
        // shouldn't try to render on the list/show/edit pages
        phoneNumber: {
            isVisible: { filter: true, list: false, show: false, edit: false },
        },
    },
}
```

> **Don't reach for `filterProperties` to do this.** A non-empty
> `filterProperties` array replaces AdminJS's default ("every visible column is
> filterable") behaviour entirely - you'd have to enumerate every other column
> you still want filterable, and it's easy to silently drop one. Scoping the
> new virtual property with `isVisible` (as above) leaves every real column's
> default filter behaviour untouched.

AdminJS labels a property from its path (`phoneNumber` → "Phone Number") unless
you configure a translation for it via the top-level `locale.translations`
option in `config/adminjs.ts` - see
[AdminJS's i18n docs](https://docs.adminjs.co/basics/internationalization) if
you need a custom label. Note that `PropertyOptions` (the type of each entry
in `properties`) has no `label` field itself.

**Why does the resolver return a function?** Lucid/Knex query builder
callbacks (`query.where((builder) => { ... })`) must be synchronous. A
resolver that needs to `await` something (like the `Profile` lookup above)
can't do that work inside such a callback. Instead, `@adminFilter` resolvers
run their async work up front and return a plain synchronous callback with the
result baked in, which the adapter then applies to the query.

#### Generic search box

Mark one or more columns `searchable: true` via `@adminColumn` to have them
participate in a generic, OR-combined search filter, available under the
reserved path `'search'` (exported as `SEARCH_PROPERTY_PATH`).

> **Reservation:** do not name a model column `search` if you need this box —
> a real `search` column takes precedence and disables multi-column search for
> that resource. `@adminFilter('search', ...)` is rejected at registration.
> Search and string-identifier `LIKE` filters escape `\`, `%`, and `_` in user
> input and emit an explicit `ESCAPE '\'` clause, so those characters are
> matched literally instead of relying on a database's default escape
> semantics.

```ts
// User.ts
import {
    AdminResourceOptions,
    SEARCH_PROPERTY_PATH,
    adminColumn,
} from '@ioc:Adonis/Addons/AdminJS'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    @adminColumn({ searchable: true })
    public username: string

    public static $adminResourceOptions: AdminResourceOptions = {
        properties: {
            [SEARCH_PROPERTY_PATH]: {
                isVisible: { filter: true, list: false, show: false, edit: false },
            },
        },
    }
}
```

Typing a value into the resulting **Search** filter runs a `LIKE` match
against every `searchable` column and OR-combines the results.

Virtual filters (see above) can join the same search box by adding
`includeInSearch: true`:

```ts
@adminFilter('phoneNumber', { type: 'string', includeInSearch: true })
public static async filterByPhoneNumber(value: string) {
    // ...same as before
}
```

Now the generic search box also searches phone numbers via the related
`Profile` table, alongside any `searchable` columns - no extra wiring needed.

### Custom Actions (`@adminAction`)

Use `@adminAction` to register a custom AdminJS action (resource, record, or
bulk - see [AdminJS's Actions docs](https://docs.adminjs.co/basics/action))
directly on the model, Django-admin style. The decorated static method becomes
the action's `handler` and is wired into that resource automatically - no
changes needed in `config/adminjs.ts`.

Built-in action names (`new`, `edit`, `delete`, `list`, `show`, `bulkDelete`,
`search`) are protected: registering one throws unless you pass
`{ override: true }`.

```ts
// User.ts
import { adminAction } from '@ioc:Adonis/Addons/AdminJS'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export class User extends BaseModel {
    @column({ isPrimary: true })
    public id: number

    @column()
    public isActive: boolean

    // a record action: shows up as a button on a single User's show/list page
    @adminAction('deactivate', {
        actionType: 'record',
        icon: 'Stop',
        guard: 'sureToDeactivate',
    })
    public static async deactivate(request, response, context) {
        const user = await User.findOrFail(context.record?.id())

        user.isActive = false
        await user.save()

        return {
            record: context.record?.toJSON(context.currentAdmin),
            notice: { message: 'User deactivated', type: 'success' },
        }
    }
}
```

The second argument to `@adminAction` (`actionType` required; `icon`, `guard`,
`component`, `isVisible`, `isAccessible`, `showInDrawer`, etc. optional) is a
small, hand-written type (`ActionDecoratorOptions`) rather than AdminJS's own
`Action` interface imported directly - see the
[note on `AdminResourceOptions`](#resource-options) above for why. Any other
AdminJS `Action` field (eg. `before`, `after`, `variant`) can still be passed
through - the type has an index signature for that - it just isn't individually
documented here. See
[here](./adonis-typings/adapter/decorator.ts#ActionDecoratorOptions) for the
explicitly-typed fields, or [AdminJS's own docs](https://docs.adminjs.co/basics/action)
for the full list of what AdminJS itself supports.
