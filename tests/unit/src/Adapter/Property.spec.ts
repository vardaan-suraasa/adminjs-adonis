import { Property } from '../../../../src/Adapter/Property'
import { test } from '@japa/runner'
import sinon from 'sinon'

test.group('Property | type', () => {
    test('Auto Computes correct type for string properties', ({
        assert,
        application,
        models,
    }) => {
        const property = application.container.make(Property, [
            models.User,
            'username',
        ])

        assert.strictEqual(property.type(), 'string')
    })

    test('Auto Computes correct type for password properties', ({
        assert,
        application,
        models,
    }) => {
        const property = application.container.make(Property, [
            models.User,
            'password',
        ])

        assert.strictEqual(property.type(), 'password')
    })

    test('Auto Computes correct type for uuid properties', ({
        assert,
        application,
        models,
    }) => {
        const { column } = application.container.use('Adonis/Lucid/Orm')
        const UserModel = models.User
        class User extends UserModel {
            @column()
            public uuid: string
        }

        const property = application.container.make(Property, [User, 'uuid'])

        assert.strictEqual(property.type(), 'uuid')
    })

    test('Auto Computes correct type for datetime properties', ({
        assert,
        application,
        models,
    }) => {
        const property = application.container.make(Property, [
            models.User,
            'createdAt',
        ])

        assert.strictEqual(property.type(), 'datetime')
    })

    test('Auto computes reference type for relations', ({
        assert,
        application,
        models,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])

        assert.strictEqual(property.type(), 'reference')
    })

    test('Takes type from adminColumnOptions', ({
        assert,
        application,
        models,
    }) => {
        const UserModel = models.User
        class User extends UserModel {}
        User.$adminColumnOptions = {
            username: {
                type: 'number',
            },
        }

        const property = application.container.make(Property, [
            User,
            'username',
        ])

        assert.strictEqual(property.type(), 'number')
    })
})

test.group('Property | reference', () => {
    test('Computes correct reference for relation fields', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])

        assert.strictEqual(property.reference(), models.User.table)
    })

    test('Computes correct reference for non-relation fields', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.User,
            'username',
        ])

        assert.strictEqual(property.reference(), null)
    })

    test('returns null when multiple belongsTo relations share the same foreign key', ({
        assert,
        models,
        application,
    }) => {
        const { belongsTo } = application.container.use('Adonis/Lucid/Orm')
        const TodoListModel = models.TodoList

        class TodoList extends TodoListModel {
            @belongsTo(() => models.User, { foreignKey: 'userId' })
            public secondaryUser: any
        }

        const property = application.container.make(Property, [
            TodoList,
            'userId',
        ])

        assert.isNull(property.reference())
    })
})

test.group('Property | getSchemaType', (group) => {
    group.each.teardown(() => sinon.restore())

    test('Returns correct schema type for reference', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        property.relation = models.TodoList.$getRelation('user')
        property.relation.boot()

        // property itself should return reference
        // and all subsequent properties should return number
        sinon.stub(property, 'type').returns('reference')
        sinon.stub(Property.prototype, 'type').returns('number')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(schemaType.getTree(), schema.number().getTree())
    })

    test('Returns correct schema type for uuid', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { rules, schema } = application.container.use(
            'Adonis/Core/Validator'
        )

        sinon.stub(property, 'type').returns('uuid')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(
            schemaType.getTree(),
            schema.string({}, [rules.uuid({ version: 'all' })]).getTree()
        )
    })

    test('Returns correct schema type for boolean', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        sinon.stub(property, 'type').returns('boolean')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(schemaType.getTree(), schema.boolean().getTree())
    })

    test('Returns correct schema type for date', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        sinon.stub(property, 'type').returns('date')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(
            schemaType.getTree(),
            schema
                .date({
                    format: 'yyyy-MM-dd',
                })
                .getTree()
        )
    })

    test('Returns correct schema type for datetime', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        sinon.stub(property, 'type').returns('datetime')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(schemaType.getTree(), schema.date().getTree())
    })

    test('Returns correct schema type for number', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        sinon.stub(property, 'type').returns('number')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(schemaType.getTree(), schema.number().getTree())
    })

    test('Returns correct schema type for float', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        sinon.stub(property, 'type').returns('float')

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(schemaType.getTree(), schema.number().getTree())
    })

    test('Returns correct schema type for enum', ({
        assert,
        models,
        application,
    }) => {
        const property = application.container.make(Property, [
            models.TodoList,
            'userId',
        ])
        const { schema } = application.container.use('Adonis/Core/Validator')

        property.columnOptions.enum = ['a', 'b', 'c', 'd']
        sinon.stub(property, 'type').returns('string')
        sinon
            .stub(property, 'availableValues')
            .returns(Object.keys(property.columnOptions.enum))

        const schemaType = property.getSchemaType()
        assert.isObject(schemaType)
        assert.isFunction(schemaType.getTree)
        assert.deepEqual(
            schemaType.getTree(),
            schema.enum(Object.keys(property.columnOptions.enum)).getTree()
        )
    })
    ;(
        [
            'password',
            'currency',
            'richtext',
            'string',
            'textarea',
            'phone',
        ] as const
    ).forEach((fieldType) => {
        test(`Returns correct schema type for ${fieldType}`, ({
            assert,
            models,
            application,
        }) => {
            const property = application.container.make(Property, [
                models.TodoList,
                'userId',
            ])
            const { schema } = application.container.use(
                'Adonis/Core/Validator'
            )

            sinon.stub(property, 'type').returns(fieldType)

            const schemaType = property.getSchemaType()
            assert.isObject(schemaType)
            assert.isFunction(schemaType.getTree)
            assert.deepEqual(schemaType.getTree(), schema.string().getTree())
        })
    })
})

test.group('Property | serialize', () => {
    test('returns value as-is when attachment value is already a url string', async ({
        assert,
        application,
        models,
    }) => {
        const UserModel = models.User
        const { column } = application.container.use('Adonis/Lucid/Orm')

        class User extends UserModel {
            @column()
            public attachment: string
        }

        User.$adminColumnOptions = {
            attachment: {
                type: 'file',
            },
        }

        const property = application.container.make(Property, [
            User,
            'attachment',
        ])

        const row = new User().fill({
            attachment: 'https://example.com/existing-file.pdf',
        })

        assert.strictEqual(
            await property.serialize(row),
            'https://example.com/existing-file.pdf'
        )
    })

    test('extracts url when attachment value is an object', async ({
        assert,
        application,
        models,
    }) => {
        const UserModel = models.User
        const { column } = application.container.use('Adonis/Lucid/Orm')

        class User extends UserModel {
            @column()
            public attachment: any
        }

        User.$adminColumnOptions = {
            attachment: {
                type: 'file',
            },
        }

        const property = application.container.make(Property, [
            User,
            'attachment',
        ])

        const row = new User().fill({
            attachment: { url: 'https://example.com/existing-file.pdf' },
        })

        assert.strictEqual(
            await property.serialize(row),
            'https://example.com/existing-file.pdf'
        )
    })
})
