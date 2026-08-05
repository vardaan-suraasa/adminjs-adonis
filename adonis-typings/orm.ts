declare module '@ioc:Adonis/Lucid/Orm' {
    import {
        AdminColumnOptions,
        AdminFilterOptions,
        AdminResourceOptions,
        ActionDecoratorHandler,
        ActionDecoratorOptions,
        FilterResolver,
    } from '@ioc:Adonis/Addons/AdminJS'

    export interface LucidModel {
        $adminColumnOptions?: Record<string, Partial<AdminColumnOptions>>
        $adminFilters?: Record<
            string,
            AdminFilterOptions & { resolve: FilterResolver }
        >
        $adminActions?: Record<
            string,
            ActionDecoratorOptions & {
                name: string
                handler: ActionDecoratorHandler
            }
        >
        /**
         * Escape hatch for resourceOptions (eg. `filterProperties`, `properties`)
         * that aren't driven by a per-column/per-action decorator. Merged into
         * this model's resource options by `AdminProvider`.
         *
         * Deliberately typed with this package's own (adminjs-version-independent)
         * {@link AdminResourceOptions} rather than AdminJS's own `ResourceOptions` -
         * see the comment on `AdminResourceOptions` for why.
         */
        $adminResourceOptions?: AdminResourceOptions
    }
}
