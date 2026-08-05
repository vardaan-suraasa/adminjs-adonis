import {
    adminAction,
    adminColumn,
    adminFilter,
} from '../../../../src/Adapter/decorators'
import { test } from '@japa/runner'

import { AdminColumnOptions } from '@ioc:Adonis/Addons/AdminJS'

test.group('decorator | adminColumn', () => {
    test('adminColumnOptions are defined when using adminColumn', ({
        assert,
        models,
    }) => {
        const columnOptions: Partial<AdminColumnOptions> = {
            visible: false,
            editable: false,
            name: 'test',
        }

        const User = models.User
        class MyUser extends User {
            @adminColumn(columnOptions)
            public username: string
        }

        assert.notExists(User.$adminColumnOptions)
        assert.isObject(MyUser.$adminColumnOptions)
        assert.isObject(MyUser.$adminColumnOptions!.username)
        assert.deepEqual(MyUser.$adminColumnOptions!.username, columnOptions)
    })
})

test.group('decorator | adminFilter', () => {
    test('registers the resolver under the given path with default options', ({
        assert,
        models,
    }) => {
        // decorators like `adminFilter`/`adminAction` call `target.boot()`, which
        // eagerly re-boots this subclass's inherited relations. Booting infers
        // relation keys from the class's own name, so the subclass must keep the
        // same name as the fixture model (shadowing it via a separate binding)
        // rather than being renamed - otherwise Lucid looks for a foreign key
        // matching the new name (eg. "myUserId") that doesn't exist on the table.
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber(_value: string) {
                return () => {}
            }
        }

        assert.notExists(UserModel.$adminFilters)
        assert.isObject(User.$adminFilters)
        assert.isObject(User.$adminFilters!.phoneNumber)
        assert.isUndefined(User.$adminFilters!.phoneNumber.type)
        assert.isUndefined(User.$adminFilters!.phoneNumber.includeInSearch)
        assert.isFunction(User.$adminFilters!.phoneNumber.resolve)
    })

    test('stores the provided type & includeInSearch options', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber', {
                type: 'number',
                includeInSearch: true,
            })
            public static async filterByPhoneNumber(_value: string) {
                return () => {}
            }
        }

        assert.strictEqual(User.$adminFilters!.phoneNumber.type, 'number')
        assert.isTrue(User.$adminFilters!.phoneNumber.includeInSearch)
    })

    test('resolve calls the decorated static method bound to the model', async ({
        assert,
        models,
    }) => {
        const UserModel = models.User
        let receivedThis: unknown
        let receivedValue: unknown

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber(
                this: unknown,
                value: string
            ) {
                receivedThis = this
                receivedValue = value

                return () => {}
            }
        }

        await User.$adminFilters!.phoneNumber.resolve('12345')

        assert.strictEqual(receivedThis, User)
        assert.strictEqual(receivedValue, '12345')
    })

    test('registering multiple filters on the same model keeps both', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber(_value: string) {
                return () => {}
            }

            @adminFilter('email')
            public static async filterByEmail(_value: string) {
                return () => {}
            }
        }

        assert.isObject(User.$adminFilters!.phoneNumber)
        assert.isObject(User.$adminFilters!.email)
    })
})

test.group('decorator | adminAction', () => {
    test('registers the handler under the given name with the provided options', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminAction('deactivate', {
                actionType: 'record',
                icon: 'Stop',
                guard: 'sureToDeactivate',
            })
            public static async deactivate() {
                return { notice: { message: 'ok' } }
            }
        }

        assert.notExists(UserModel.$adminActions)
        assert.isObject(User.$adminActions)

        const action = User.$adminActions!.deactivate

        assert.strictEqual(action.name, 'deactivate')
        assert.strictEqual(action.actionType, 'record')
        assert.strictEqual(action.icon, 'Stop')
        assert.strictEqual(action.guard, 'sureToDeactivate')
        assert.isFunction(action.handler)
    })

    test('handler calls the decorated static method bound to the model', async ({
        assert,
        models,
    }) => {
        const UserModel = models.User
        let receivedThis: unknown

        class User extends UserModel {
            @adminAction('deactivate', { actionType: 'record' })
            public static async deactivate(this: unknown) {
                receivedThis = this

                return { notice: { message: 'ok' } }
            }
        }

        const result = await User.$adminActions!.deactivate.handler(
            {} as any,
            {} as any,
            {} as any
        )

        assert.strictEqual(receivedThis, User)
        assert.deepEqual(result, { notice: { message: 'ok' } })
    })

    test('registering multiple actions on the same model keeps both', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminAction('deactivate', { actionType: 'record' })
            public static async deactivate() {
                return {}
            }

            @adminAction('exportAll', { actionType: 'resource' })
            public static async exportAll() {
                return {}
            }
        }

        assert.isObject(User.$adminActions!.deactivate)
        assert.isObject(User.$adminActions!.exportAll)
    })
})
