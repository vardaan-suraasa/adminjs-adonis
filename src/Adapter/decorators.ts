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

        model.$defineProperty('$adminFilters', {}, 'inherit')
        model.$adminFilters![path] = {
            ...options,
            resolve: target[property].bind(target),
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

        model.$defineProperty('$adminActions', {}, 'inherit')
        model.$adminActions![name] = {
            ...options,
            name,
            handler: target[property].bind(target),
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
