declare module '@ioc:Adonis/Addons/AdminJS' {
    import { PropertyType } from 'adminjs'
    import {
        LucidModel,
        LucidRow,
        ModelQueryBuilderContract,
    } from '@ioc:Adonis/Lucid/Orm'

    export type AdminColumnOptions = {
        /**
         * Name of field.
         */
        name: string
        /**
         * Position of display in the form.
         * Defaults to 1
         */
        position: number
        /**
         * Type of field.
         */
        type?: PropertyType | 'file'
        /**
         * Whether field is visible or not. Defaults to true
         */
        visible: boolean
        /**
         * Whether field is editable or not. Defaults to false for primary key & true for all others
         */
        editable: boolean
        /**
         * Whether field is unique or not. Defaults to true for primary key & false for all others
         */
        unique: boolean
        /**
         * Available enum options for this field.
         */
        enum?: Record<string, any>
        /**
         * Whether field is sortable or not. Defaults to true
         */
        sortable: boolean
        /**
         * Whether field participates in the generic multi-column search
         * (see {@link SEARCH_PROPERTY_PATH}). Defaults to false
         */
        searchable: boolean
        /**
         * Whether field is optional or not. Defaults to false
         */
        optional: boolean
        /**
         * Function to convert attribute to displayable value
         */
        serialize?: (
            value: any,
            attribute: string,
            instance: LucidRow
        ) => any | Promise<any>
    }

    export function adminColumn(
        options: Partial<AdminColumnOptions>
    ): (target: LucidRow, property: string) => void

    /**
     * Type for decorators providing hook functionalities
     */
    export type HookDecorator<ArgType> = () => <
        Property extends string,
        T extends LucidModel &
            Record<Property, (arg: ArgType) => Promise<void> | void>
    >(
        target: T,
        property: Property
    ) => void

    /**
     * Before create hook.
     * Executed after all parameters have been validated but before save is called.
     *
     * Runs before the original 'beforeCreate' hook of AdonisJS
     */
    export const beforeCreate: HookDecorator<LucidRow>

    /**
     * Before update hook.
     * Executed after all parameters have been validated but before save is called.
     *
     * Runs before the original 'beforeUpdate' hook of AdonisJS
     */
    export const beforeUpdate: HookDecorator<LucidRow>

    /**
     * Before delete hook.
     *
     * Runs before the original 'beforeDelete' hook of AdonisJS
     */
    export const beforeDelete: HookDecorator<LucidRow>

    /**
     * Before find hook.
     * Executed when a single object is fetched i.e on show & edit pages.
     *
     * Runs before the original 'beforeFind' hook of AdonisJS
     */
    export const beforeFind: HookDecorator<
        ModelQueryBuilderContract<LucidModel>
    >

    /**
     * Before fetch hook.
     * Executed when multiple objects are fetched i.e on list & filter pages
     * or when the list of objects is displayed in select box of related fields.
     *
     * Runs before the original 'beforeCreate' hook of AdonisJS
     */
    export const beforeFetch: HookDecorator<
        ModelQueryBuilderContract<LucidModel>
    >

    /**
     * After create hook.
     * Only called if create operation is completed successfully.
     *
     * Runs after the original 'afterCreate' hook of AdonisJS
     */
    export const afterCreate: HookDecorator<LucidRow>

    /**
     * After update hook.
     * Only called if update operation is completed successfully.
     *
     * Runs after the original 'afterUpdate' hook of AdonisJS
     */
    export const afterUpdate: HookDecorator<LucidRow>

    /**
     * After delete hook.
     * Only called if delete operation is completed successfully.
     *
     * Runs after the original 'afterDelete' hook of AdonisJS
     */
    export const afterDelete: HookDecorator<LucidRow>

    /**
     * After find hook.
     * Executed when a single object is fetched i.e on show & edit pages.
     *
     * Runs after the original 'afterFind' hook of AdonisJS
     */
    export const afterFind: HookDecorator<LucidRow>

    /**
     * After fetch hook.
     * Executed when multiple objects are fetched i.e on list & filter pages
     * or when the list of objects is displayed in select box of related fields.
     *
     * Runs after the original 'beforeCreate' hook of AdonisJS
     */
    export const afterFetch: HookDecorator<LucidRow[]>

    /**
     * Reserved filter path for the generic, multi-column search box.
     * Any column decorated with `@adminColumn({ searchable: true })`, and any
     * `@adminFilter` marked `includeInSearch: true`, is OR'd together when this
     * path is submitted as a filter.
     *
     * Must not collide with a real column named `search` — if such a column
     * exists, column filtering wins and multi-column search is unavailable for
     * that resource. `@adminFilter('search', ...)` is rejected at registration.
     */
    export const SEARCH_PROPERTY_PATH: 'search'

    /**
     * Options for a virtual (non-column) filter registered via {@link adminFilter}
     */
    export type AdminFilterOptions = {
        /**
         * Type of value this filter accepts. Defaults to 'string'.
         * For `date` / `datetime`, AdminJS may submit a range object
         * `{ from?, to? }` — see {@link AdminFilterValue}.
         */
        type?: PropertyType
        /**
         * Whether this filter should also be OR'd into the generic multi-column
         * search box registered at {@link SEARCH_PROPERTY_PATH}. Defaults to false
         */
        includeInSearch?: boolean
    }

    /**
     * Value passed to a {@link FilterResolver}. Scalar filters receive a string;
     * date/datetime (and other range) filters receive AdminJS's `{ from, to }`
     * object. Empty string / nullish values are not forwarded (the filter is skipped).
     */
    export type AdminFilterValue = string | { from?: string; to?: string }

    /**
     * A resolver for a virtual filter. Receives the raw filter value and must
     * resolve any async work (eg. querying other tables) up front, returning a
     * synchronous callback that mutates the query builder it's given.
     *
     * The callback is invoked either directly (when the filter is used on its
     * own) or nested inside an `orWhere` group (when it's included in the
     * generic search), so it must not assume it's the only condition applied.
     */
    export type FilterResolver = (
        value: AdminFilterValue
    ) => Promise<(builder: ModelQueryBuilderContract<LucidModel>) => void>

    /**
     * Type for the decorator providing virtual filter functionality
     */
    export type FilterDecorator = (
        path: string,
        options?: AdminFilterOptions
    ) => <
        Property extends string,
        T extends LucidModel & Record<Property, FilterResolver>
    >(
        target: T,
        property: Property
    ) => void

    /**
     * Registers a static method as a virtual (non-column) filter for this model,
     * available under the given path in the AdminJS filter drawer.
     *
     * Runs when a filter/search request includes a value for `path`.
     */
    export const adminFilter: FilterDecorator

    /**
     * Options for a custom admin action registered via {@link adminAction}.
     *
     * Hand-written rather than imported from AdminJS's own `Action` interface,
     * so that a consuming app doesn't need the exact same `adminjs` version
     * installed as this package's own dependency to satisfy the type checker -
     * AdminProvider merges this into AdminJS's real `Action` type internally,
     * where version differences don't cross a package boundary. Mirrors the
     * commonly used subset of AdminJS's options; see
     * https://docs.adminjs.co/basics/action for the full list AdminJS itself
     * supports (anything not listed here can still be passed through - see
     * the index signature below).
     */
    export type ActionDecoratorOptions = {
        /**
         * Type of action - 'resource' (whole resource), 'record' (single row),
         * or 'bulk' (multiple selected rows)
         */
        actionType: 'resource' | 'record' | 'bulk'
        /**
         * Icon name for the action button
         */
        icon?: string
        /**
         * Guard message - user has to confirm this before the action runs
         */
        guard?: string
        /**
         * Component used to render the action. `false` means no dedicated
         * view - the action runs immediately when clicked
         */
        component?: string | false
        /**
         * Whether the action is visible - boolean, or a function receiving
         * the AdminJS action context
         */
        isVisible?: boolean | ((context: any) => boolean)
        /**
         * Whether the action can be invoked - boolean, or a function
         * receiving the AdminJS action context
         */
        isAccessible?: boolean | ((context: any) => boolean)
        /**
         * Whether the action should open in a drawer instead of a full page.
         * Defaults to false
         */
        showInDrawer?: boolean
        /**
         * Set to `true` to intentionally replace a built-in AdminJS action
         * (`new`, `edit`, `delete`, `list`, `show`, `bulkDelete`, `search`).
         * Without this flag, `@adminAction` with a built-in name throws.
         */
        override?: boolean
        /**
         * Any other AdminJS `Action` option (eg. `variant`, `containerWidth`,
         * `layout`, `before`, `after`) - passed through as-is
         */
        [key: string]: any
    }

    /**
     * Handler signature for a custom admin action - matches AdminJS's own
     * `ActionHandler` shape structurally, without importing it.
     */
    export type ActionDecoratorHandler = (
        request: any,
        response: any,
        context: any
    ) => Promise<any>

    /**
     * Type for the decorator providing custom admin action functionality
     */
    export type ActionDecorator = (
        name: string,
        options: ActionDecoratorOptions
    ) => <
        Property extends string,
        T extends LucidModel & Record<Property, ActionDecoratorHandler>
    >(
        target: T,
        property: Property
    ) => void

    /**
     * Registers a static method as a custom AdminJS action (resource, record or
     * bulk) for this model. The decorated method becomes the action's handler
     * and is automatically wired into the resource's `options.actions` - no
     * manual config-file changes needed.
     */
    export const adminAction: ActionDecorator

    /**
     * A minimal, adminjs-version-independent subset of AdminJS's own
     * `ResourceOptions`, for the fields {@link AdminProvider} merges in
     * automatically via a model's static `$adminResourceOptions`.
     *
     * Hand-written rather than imported from `adminjs` for the same reason as
     * {@link ActionDecoratorOptions} above - see
     * https://docs.adminjs.co/basics/resource#resourceoptions for the full
     * list of options AdminJS itself supports (anything not listed here can
     * still be passed through - see the index signature below).
     */
    export type AdminResourceOptions = {
        /**
         * Paths (real columns, or virtual `@adminFilter`/search paths) which
         * should be visible in the filter drawer. Prefer scoping a virtual
         * path via its own `properties.<path>.isVisible.filter` (see below)
         * over setting this - a non-empty `filterProperties` replaces every
         * column's default filter visibility, not just adds to it.
         */
        filterProperties?: string[]
        /**
         * Paths which should be visible on the list view
         */
        listProperties?: string[]
        /**
         * Paths which should be visible on the edit view
         */
        editProperties?: string[]
        /**
         * Paths which should be visible on the show view
         */
        showProperties?: string[]
        /**
         * Per-property configuration, keyed by path. An entry (even an empty
         * one) is required for any virtual `@adminFilter`/search path to
         * appear in the UI at all - see the "Filtering" section of the README
         */
        properties?: Record<
            string,
            {
                isVisible?:
                    | boolean
                    | {
                          list?: boolean
                          show?: boolean
                          edit?: boolean
                          filter?: boolean
                      }
                [key: string]: any
            }
        >
        /**
         * Custom actions - usually populated automatically from
         * `@adminAction`, but can be extended here too
         */
        actions?: Record<
            string,
            Partial<ActionDecoratorOptions> & {
                handler?: ActionDecoratorHandler
            }
        >
        /**
         * Any other AdminJS `ResourceOptions` field (eg. `navigation`, `sort`,
         * `id`) - passed through as-is
         */
        [key: string]: any
    }
}
