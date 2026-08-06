import type {
    ActionDecorator,
    AdminColumnOptions,
    FilterDecorator,
    HookDecorator,
} from '@ioc:Adonis/Addons/AdminJS'
import type {
    LucidModel,
    LucidRow,
    ModelQueryBuilderContract,
} from '@ioc:Adonis/Lucid/Orm'

/**
 * AdminJS built-in action names. Registering `@adminAction` with one of these
 * requires `{ override: true }` so misnamed custom actions do not silently
 * replace core behaviour.
 */
export const BUILTIN_ADMIN_ACTIONS = new Set([
    'new',
    'edit',
    'delete',
    'list',
    'show',
    'bulkDelete',
    'search',
])

/**
 * Define type, optional etc properties for AdminJS
 */
export function adminColumn(options: Partial<AdminColumnOptions>) {
    return function (target: LucidRow, property: string) {
        const model = target.constructor as LucidModel

        model.$defineProperty('$adminColumnOptions', {}, 'inherit')

        model.$adminColumnOptions![property] = options
    }
}

/**
 * Reserved filter path for the generic, multi-column search box.
 *
 * Do not name a column or `@adminFilter` path `search` if you need the
 * generic search box — a real column named `search` takes precedence and
 * disables multi-column search for that resource.
 */
export const SEARCH_PROPERTY_PATH = 'search'

/**
 * Registers a static method as a virtual (non-column) filter, available under
 * the given path in the AdminJS filter drawer.
 */
export const adminFilter: FilterDecorator = (path, options = {}) =>
    function (target, property) {
        target.boot()

        const model = target as unknown as LucidModel

        if (path === SEARCH_PROPERTY_PATH) {
            throw new Error(
                `@adminFilter path "${path}" is reserved for the generic multi-column search box (SEARCH_PROPERTY_PATH) on ${model.name}`
            )
        }

        if (model.$columnsDefinitions.has(path)) {
            throw new Error(
                `@adminFilter path "${path}" collides with an existing column on ${model.name}. Use a non-column path for virtual filters.`
            )
        }

        if (
            model.$adminFilters &&
            Object.prototype.hasOwnProperty.call(model.$adminFilters, path)
        ) {
            throw new Error(
                `@adminFilter path "${path}" is already registered on ${model.name}`
            )
        }

        model.$defineProperty('$adminFilters', {}, 'inherit')
        model.$adminFilters![path] = {
            ...options,
            resolve: target[property],
        }
    }

/**
 * Registers a static method as a custom AdminJS action (resource, record or
 * bulk) for this model, automatically wired into the resource's
 * `options.actions` by {@link AdminProvider}.
 */
export const adminAction: ActionDecorator = (name, options) =>
    function (target, property) {
        target.boot()

        const model = target as unknown as LucidModel

        if (BUILTIN_ADMIN_ACTIONS.has(name) && !options.override) {
            throw new Error(
                `@adminAction("${name}") would replace a built-in AdminJS action on ${model.name}. Pass { override: true } if that is intentional.`
            )
        }

        if (
            model.$adminActions &&
            Object.prototype.hasOwnProperty.call(model.$adminActions, name)
        ) {
            throw new Error(
                `@adminAction name "${name}" is already registered on ${model.name}`
            )
        }

        model.$defineProperty('$adminActions', {}, 'inherit')
        model.$adminActions![name] = {
            ...options,
            name,
            handler: target[property],
        }
    }

export const beforeCreate: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add(
            'before',
            'adminCreate',
            target[property].bind(target)
        )
    }

export const beforeUpdate: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add(
            'before',
            'adminUpdate',
            target[property].bind(target)
        )
    }

export const beforeDelete: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add(
            'before',
            'adminDelete',
            target[property].bind(target)
        )
    }

export const beforeFind: HookDecorator<
    ModelQueryBuilderContract<LucidModel>
> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('before', 'adminFind', target[property].bind(target))
    }

export const beforeFetch: HookDecorator<
    ModelQueryBuilderContract<LucidModel>
> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('before', 'adminFetch', target[property].bind(target))
    }

export const afterCreate: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('after', 'adminCreate', target[property].bind(target))
    }

export const afterUpdate: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('after', 'adminUpdate', target[property].bind(target))
    }

export const afterDelete: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('after', 'adminDelete', target[property].bind(target))
    }

export const afterFind: HookDecorator<LucidRow> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('after', 'adminFind', target[property].bind(target))
    }

export const afterFetch: HookDecorator<LucidRow[]> = () =>
    function (target, property) {
        target.boot()
        target.$hooks.add('after', 'adminFetch', target[property].bind(target))
    }
