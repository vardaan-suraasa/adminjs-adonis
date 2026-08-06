import {
    adminAction,
    adminColumn,
    adminFilter,
    SEARCH_PROPERTY_PATH,
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

    test('stores an unbound resolver that can use the concrete child model', async ({
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

        const ParentUser = User
        const ChildUser = Object.defineProperty(
            class ChildUser extends ParentUser {},
            'name',
            { value: 'User' }
        )

        await ChildUser.$adminFilters!.phoneNumber.resolve.call(
            ChildUser,
            '12345'
        )

        assert.strictEqual(receivedThis, ChildUser)
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

    test('throws when path is the reserved SEARCH_PROPERTY_PATH', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        assert.throws(() => {
            class User extends UserModel {
                @adminFilter(SEARCH_PROPERTY_PATH)
                public static async filterBySearch(_value: string) {
                    return () => {}
                }
            }

            return User
        }, /reserved/)
    })

    test('throws when path collides with an existing column', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        assert.throws(() => {
            class User extends UserModel {
                @adminFilter('username')
                public static async filterByUsername(_value: string) {
                    return () => {}
                }
            }

            return User
        }, /collides with an existing column/)
    })

    test('throws when the same path is registered twice on one model', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        assert.throws(() => {
            class User extends UserModel {
                @adminFilter('phoneNumber')
                public static async filterByPhoneNumber(_value: string) {
                    return () => {}
                }

                @adminFilter('phoneNumber')
                public static async filterByPhoneNumberAgain(_value: string) {
                    return () => {}
                }
            }

            return User
        }, /already registered/)
    })

    test('throws when a child registers an inherited filter path', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber(_value: string) {
                return () => {}
            }
        }

        const ParentUser = User

        class ChildUser extends ParentUser {
            public static async filterByPhoneNumberAgain(_value: string) {
                return () => {}
            }
        }

        Object.defineProperty(ChildUser, 'name', { value: 'User' })

        assert.throws(
            () =>
                adminFilter('phoneNumber')(
                    ChildUser as any,
                    'filterByPhoneNumberAgain'
                ),
            /already registered/
        )
    })

    test('adding a distinct child filter does not mutate parent metadata', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber(_value: string) {
                return () => {}
            }
        }

        const ParentUser = User

        class ChildUser extends ParentUser {
            public static async filterByAccountState(_value: string) {
                return () => {}
            }
        }

        Object.defineProperty(ChildUser, 'name', { value: 'User' })
        adminFilter('accountState')(ChildUser as any, 'filterByAccountState')

        assert.deepEqual(Object.keys(ParentUser.$adminFilters!), [
            'phoneNumber',
        ])
        assert.deepEqual(Object.keys(ChildUser.$adminFilters!), [
            'phoneNumber',
            'accountState',
        ])
        assert.notStrictEqual(ChildUser.$adminFilters, ParentUser.$adminFilters)
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

    test('stores an unbound handler that can use the concrete child model', async ({
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

        const ParentUser = User
        const ChildUser = Object.defineProperty(
            class ChildUser extends ParentUser {},
            'name',
            { value: 'User' }
        )
        const result = await User.$adminActions!.deactivate.handler.call(
            ChildUser,
            {} as any,
            {} as any,
            {} as any
        )

        assert.strictEqual(receivedThis, ChildUser)
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

    test('throws when registering a built-in action name without override', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        assert.throws(() => {
            class User extends UserModel {
                @adminAction('delete', { actionType: 'record' })
                public static async deleteAction() {
                    return {}
                }
            }

            return User
        }, /built-in AdminJS action/)
    })

    test('allows built-in action name when override is true', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminAction('delete', { actionType: 'record', override: true })
            public static async deleteAction() {
                return {}
            }
        }

        assert.isObject(User.$adminActions!.delete)
        assert.isTrue(User.$adminActions!.delete.override)
    })

    test('throws when the same action name is registered twice on one model', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        assert.throws(() => {
            class User extends UserModel {
                @adminAction('deactivate', { actionType: 'record' })
                public static async deactivate() {
                    return {}
                }

                @adminAction('deactivate', { actionType: 'record' })
                public static async deactivateAgain() {
                    return {}
                }
            }

            return User
        }, /already registered/)
    })

    test('throws when a child registers an inherited action name', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminAction('deactivate', { actionType: 'record' })
            public static async deactivate() {
                return {}
            }
        }

        const ParentUser = User

        class ChildUser extends ParentUser {
            public static async deactivateAgain() {
                return {}
            }
        }

        Object.defineProperty(ChildUser, 'name', { value: 'User' })

        assert.throws(
            () =>
                adminAction('deactivate', { actionType: 'record' })(
                    ChildUser as any,
                    'deactivateAgain'
                ),
            /already registered/
        )
    })

    test('adding a distinct child action does not mutate parent metadata', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminAction('deactivate', { actionType: 'record' })
            public static async deactivate() {
                return {}
            }
        }

        const ParentUser = User

        class ChildUser extends ParentUser {
            public static async exportAll() {
                return {}
            }
        }

        Object.defineProperty(ChildUser, 'name', { value: 'User' })
        adminAction('exportAll', { actionType: 'resource' })(
            ChildUser as any,
            'exportAll'
        )

        assert.deepEqual(Object.keys(ParentUser.$adminActions!), ['deactivate'])
        assert.deepEqual(Object.keys(ChildUser.$adminActions!), [
            'deactivate',
            'exportAll',
        ])
        assert.notStrictEqual(ChildUser.$adminActions, ParentUser.$adminActions)
    })
})
