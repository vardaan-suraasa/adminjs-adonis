import { getEnumValue } from '../helpers'
import { inject } from '@adonisjs/core/build/standalone'
import {
    BaseProperty,
    BaseResource as BaseAdminResource,
    ErrorTypeEnum,
    Filter,
    ParamsType,
    PropertyErrors,
    ResourceOptions,
    ValidationError,
} from 'adminjs'
import AdminJS from 'adminjs/types/src'
import Validator from 'validator'

import type { TypedSchema } from '@ioc:Adonis/Core/Validator'
import type {
    LucidModel,
    LucidRow,
    ModelQueryBuilderContract,
} from '@ioc:Adonis/Lucid/Orm'

import { components } from './Components'
import { Property } from './Property'
import { LucidRecord } from './Record'
import { SEARCH_PROPERTY_PATH } from './decorators'
import { escapeLikePattern, getAdminColumnOptions } from './helpers'

type WhereClause = (builder: ModelQueryBuilderContract<LucidModel>) => void

/**
 * Resource adapter for AdminJS
 */
@inject([null, 'Adonis/Core/Validator'])
export class BaseResource extends BaseAdminResource {
    constructor(
        public readonly model: LucidModel,
        private validator: typeof import('@ioc:Adonis/Core/Validator')
    ) {
        super(model)
    }

    /**
     * Whether this class can be used for the given model
     */
    public static isAdapterFor(model: any) {
        // we can't import BaseModel here so we have to use this hacky way
        return (
            typeof model === 'function' &&
            model &&
            ['$columnsDefinitions', '$relationsDefinitions'].filter(
                (property) => property in model
            )
        )
    }

    /**
     * The database being used by this resource
     */
    public databaseName(): string {
        return 'lucid'
    }

    /**
     * Type of database being used by this resource
     */
    public databaseType(): string {
        return this.model.query().client.dialect.name
    }

    /**
     * Name of this resource
     */
    public name() {
        return this.model.name
    }

    /**
     * Unique identifier for this resource
     */
    public id() {
        return this.model.table
    }

    /**
     * Helper to get list of properties for this resource
     */
    public properties() {
        const properties: Property[] = []

        for (const column of this.model.$columnsDefinitions.keys()) {
            // property() always returns a real Property for column paths
            properties.push(this.property(column) as Property)
        }

        return properties
    }

    /**
     * Helper to get property for the given column, the reserved generic
     * search path, or a registered virtual filter path.
     *
     * Precedence: real column > reserved search path > virtual filter.
     * `@adminFilter` rejects column paths and `SEARCH_PROPERTY_PATH`, so
     * virtual filters never collide with the first two branches.
     */
    public property(path: string) {
        if (this.model.$columnsDefinitions.has(path)) {
            return new Property(this.model, path, this.validator)
        }

        if (path === SEARCH_PROPERTY_PATH) {
            return new BaseProperty({ path, type: 'string', isSortable: false })
        }

        const filterOptions = this.model.$adminFilters?.[path]

        if (filterOptions) {
            return new BaseProperty({
                path,
                type: filterOptions.type || 'string',
                isSortable: false,
            })
        }

        return null
    }

    /**
     * Helper to apply filters (including the reserved search path & any
     * registered virtual filters) on a given query.
     *
     * Mutates `query` in place and doesn't return it: Lucid query builders are
     * themselves thenable (awaiting one executes the query), so this being an
     * `async` function must never `return query` - doing so would make the
     * promise-resolution algorithm call `query.then()` to unwrap it, executing
     * the query before callers get to add `.limit()`/`.offset()`/`.orderBy()`.
     */
    public async applyFilter(
        query: ModelQueryBuilderContract<LucidModel>,
        filter: Filter
    ): Promise<void> {
        for (const key of Object.keys(filter.filters)) {
            const filterElement = filter.filters[key]

            // Only treat the reserved path as generic search when it is not a
            // real column (a column named `search` keeps column-filter behaviour).
            if (
                key === SEARCH_PROPERTY_PATH &&
                !this.model.$columnsDefinitions.has(key)
            ) {
                await this.applySearch(query, String(filterElement.value ?? ''))
                continue
            }

            const virtualFilter = this.model.$adminFilters?.[key]

            if (virtualFilter) {
                const value = filterElement.value

                // Match applySearch: skip empty submissions so resolvers are
                // not invoked for vacuous filter UI state.
                if (value === '' || value === null || value === undefined) {
                    continue
                }

                // Pass the raw AdminJS filter value through (string or
                // `{ from, to }` range) — do not String() objects.
                const applyWhere = await virtualFilter.resolve(value)
                query.where(applyWhere)
                continue
            }

            const property = filterElement.property as Property

            if (typeof filterElement.value === 'string') {
                if (
                    property.type() === 'uuid' &&
                    !Validator.isUUID(filterElement.value)
                ) {
                    continue
                }

                if (property.columnOptions.enum) {
                    try {
                        query.where(
                            key,
                            getEnumValue(
                                property.columnOptions.enum,
                                filterElement.value
                            )
                        )
                    } catch {
                        // Invalid / stale enum filter input — skip like malformed UUIDs
                        continue
                    }
                } else if (property.isId() && property.type() === 'string') {
                    query.whereLike(
                        key,
                        `%${escapeLikePattern(filterElement.value)}%`
                    )
                } else {
                    query.where(key, filterElement.value)
                }
            } else {
                query.whereBetween(key, [
                    filterElement.value.from,
                    filterElement.value.to,
                ])
            }
        }
    }

    /**
     * Helper to apply the generic multi-column search (see
     * {@link SEARCH_PROPERTY_PATH}) on a given query.
     *
     * OR-combines a `whereLike` for every column marked `searchable: true`
     * with every registered virtual filter marked `includeInSearch: true`.
     * Each virtual filter's async work is resolved up front so the final
     * combination only needs a synchronous query builder callback.
     */
    private async applySearch(
        query: ModelQueryBuilderContract<LucidModel>,
        value: string
    ) {
        if (!value) {
            return
        }

        const like = `%${escapeLikePattern(value)}%`
        const wheres: WhereClause[] = []

        for (const column of this.model.$columnsDefinitions.keys()) {
            if (getAdminColumnOptions(this.model, column).searchable) {
                // OR composition happens on the outer group; each clause is a
                // plain `whereLike` (not nested `orWhereLike`).
                wheres.push((builder) => builder.whereLike(column, like))
            }
        }

        for (const filterOptions of Object.values(
            this.model.$adminFilters || {}
        )) {
            if (filterOptions.includeInSearch) {
                wheres.push(await filterOptions.resolve(value))
            }
        }

        if (!wheres.length) {
            return
        }

        query.where((builder) => {
            wheres.forEach((applyWhere, index) => {
                if (index === 0) {
                    builder.where(applyWhere)
                } else {
                    builder.orWhere(applyWhere)
                }
            })
        })
    }

    /**
     * Returns number of objects matching the given filter
     */
    public async count(filter: Filter) {
        const query = this.model.query()

        await this.applyFilter(query, filter)

        const obj = await query.count('*', 'count').firstOrFail()

        return +obj.$extras.count
    }

    /**
     * Returns list of objects matching the given filter
     */
    public async find(
        filter: Filter,
        options: {
            limit?: number | undefined
            offset?: number | undefined
            sort?:
                | {
                      sortBy?: string | undefined
                      direction?: 'asc' | 'desc' | undefined
                  }
                | undefined
        }
    ): Promise<LucidRecord[]> {
        const query = this.model.query()

        await this.applyFilter(query, filter)

        if (options.limit !== undefined) {
            query.limit(options.limit)
        }

        if (options.offset !== undefined) {
            query.offset(options.offset)
        }

        if (options.sort !== undefined) {
            query.orderBy(
                options.sort.sortBy || this.model.primaryKey,
                options.sort.direction
            )
        }

        await this.model.$hooks.exec('before', 'adminFetch', query)

        const data = await query

        await this.model.$hooks.exec('after', 'adminFetch', data)

        const objects: LucidRecord[] = []

        for (const obj of data) {
            objects.push(this.build(await this.sanitizeParams(obj)))
        }

        return objects
    }

    /**
     * Returns object matching the given resource id
     */
    public async findOne(id: string) {
        const query = this.model.query().where(this.model.primaryKey, id)

        await this.model.$hooks.exec('before', 'adminFind', query)

        const obj = await query.first()

        if (!obj) {
            return null
        }

        await this.model.$hooks.exec('after', 'adminFind', obj)

        return this.build(await this.sanitizeParams(obj))
    }

    /**
     * Returns list of objects matching the given resource ids
     * @param ids
     * @returns
     */
    public async findMany(ids: (string | number)[]) {
        const query = this.model.query().whereIn(this.model.primaryKey, ids)

        await this.model.$hooks.exec('before', 'adminFetch', query)

        const data = await query

        await this.model.$hooks.exec('after', 'adminFetch', data)

        const objects: LucidRecord[] = []

        for (const obj of data) {
            objects.push(this.build(await this.sanitizeParams(obj)))
        }

        return objects
    }

    /**
     * Sanitizes parameters so that they can be passed to {@link LucidRecord}
     */
    public async sanitizeParams(row: LucidRow) {
        const data: Record<string, any> = {}

        for (const property of this.properties()) {
            if (!property.isEditable() && !property.isVisible()) {
                continue
            }

            try {
                data[property.path()] = await property.serialize(row)
            } catch (error) {
                error.message = `Failed to serialize property "${property.path()}" on resource "${this.id()}": ${
                    error.message
                }`

                throw error
            }
        }

        return data
    }

    /**
     * Helper to build {@link LucidRecord} from params
     */
    public build(params: Record<string, any>): LucidRecord {
        return new LucidRecord(params, this)
    }

    /**
     * Helper to validate params passed during creation / updation.
     *
     * TODO: add support for JSON
     */
    public async validateParams(params: ParamsType) {
        const propertyHash: Record<string, Property> = {}
        // A string value for an attachment property means no new file was
        // uploaded (it's either the existing url or an empty string when the
        // input was cleared) so it shouldn't go through file validation.
        const unchangedAttachments: Record<string, null> = {}

        const validatorSchema = this.validator.schema.create(
            this.properties().reduce((acc, property) => {
                if (!property.isEditable()) {
                    return acc
                }

                if (
                    property.isAttachment &&
                    typeof params[property.path()] === 'string'
                ) {
                    if (!params[property.path()]) {
                        // Cleared file input: only force null for optional
                        // attachments. Required attachments stay in the schema
                        // path so empty clear fails validation instead of
                        // silently writing null.
                        if (property.columnOptions.optional) {
                            unchangedAttachments[property.path()] = null

                            return acc
                        }
                    } else {
                        // Existing URL string — no new upload; skip file schema
                        return acc
                    }
                }

                acc[property.path()] = property.getSchemaType()
                propertyHash[property.path()] = property

                return acc
            }, {} as TypedSchema)
        )

        try {
            const data = await this.validator.validator.validate({
                schema: validatorSchema,
                data: params,
            })

            Object.entries(propertyHash).forEach(([key, property]) => {
                if (property.columnOptions.enum) {
                    // convert enum string value to integer
                    data[key] = getEnumValue(
                        property.columnOptions.enum,
                        data[key]
                    )
                }
            })

            return { ...data, ...unchangedAttachments }
        } catch (error) {
            if (error instanceof this.validator.ValidationException) {
                // build AdminJS validation error from Adonis' ValidationException
                throw new ValidationError(
                    Object.entries((error as any).messages).reduce(
                        (acc, [key, messages]) => {
                            acc[key] = {
                                type: ErrorTypeEnum.Validation,
                                message: String(messages),
                            }

                            return acc
                        },
                        {} as PropertyErrors
                    )
                )
            }

            throw error
        }
    }

    /**
     * Create a new object in database and return its parameters
     */
    public async create(params: Record<string, any>): Promise<ParamsType> {
        const data = await this.validateParams(params)
        const object = new this.model().fill(data)

        await this.model.$hooks.exec('before', 'adminCreate', object)

        await object.save()

        await this.model.$hooks.exec('after', 'adminCreate', object)

        return await this.sanitizeParams(object)
    }

    /**
     * Update an existing object in database and return its parameters
     */
    public async update(
        id: string | number,
        params: Record<string, any>
    ): Promise<ParamsType> {
        const object = await this.model.findOrFail(id)
        object.merge(await this.validateParams(params))

        await this.model.$hooks.exec('before', 'adminUpdate', object)

        await object.save()

        await this.model.$hooks.exec('after', 'adminUpdate', object)

        return await this.sanitizeParams(object)
    }

    /**
     * Delete an object from database
     */
    public async delete(id: string | number) {
        const object = await this.model.find(id)

        await this.model.$hooks.exec('before', 'adminDelete', object)

        await object?.delete()

        await this.model.$hooks.exec('after', 'adminDelete', object)
    }

    /**
     * Helper used internally by adminjs to assign decorator to this resource.
     * In order to add support for file attachments, we update the options property
     * to override the components which are rendered so that proper file in displayed
     */
    public assignDecorator(
        admin: AdminJS,
        options?: ResourceOptions | undefined
    ): void {
        const finalOptions: ResourceOptions = options || {}

        finalOptions.properties = finalOptions.properties || {}

        for (const property of this.properties()) {
            if (
                property.isAttachment &&
                !finalOptions.properties[property.path()]
            ) {
                finalOptions.properties[property.path()] = {
                    components: {
                        edit: components.FileInput,
                        list: components.ListUrl,
                        show: components.ShowUrl,
                    },
                }

                if (property.attachmentOptions?.extnames) {
                    finalOptions.properties[property.path()].props = {
                        accept: property.attachmentOptions?.extnames
                            .map((ext) => `.${ext}`)
                            .join(','),
                    }
                }
            }
        }

        return super.assignDecorator(admin, finalOptions)
    }
}
