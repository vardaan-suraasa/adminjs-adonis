import { buildResourceDefinition } from '../../../providers/AdminProvider'
import { adminAction, adminFilter } from '../../../src/Adapter/decorators'
import { test } from '@japa/runner'

import type { AdminResourceOptions } from '@ioc:Adonis/Addons/AdminJS'

test.group('AdminProvider | buildResourceDefinition', () => {
    test('merges resource actions and decorated actions with decorators taking precedence', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            public static $adminResourceOptions: AdminResourceOptions = {
                navigation: 'People',
                actions: {
                    delete: { isAccessible: false },
                    deactivate: {
                        actionType: 'record',
                        icon: 'Pause',
                    },
                },
            }

            @adminAction('deactivate', {
                actionType: 'record',
                icon: 'Stop',
                override: true,
            })
            public static async deactivate() {
                return {}
            }
        }

        const definition = buildResourceDefinition(User)

        assert.strictEqual(definition.resource, User)
        assert.strictEqual(definition.options.navigation, 'People')
        assert.deepEqual(definition.options.actions!.delete, {
            isAccessible: false,
        })
        assert.strictEqual(definition.options.actions!.deactivate.icon, 'Stop')
    })

    test('binds inherited decorated handlers to the concrete model and strips internal fields', async ({
        assert,
        models,
    }) => {
        const UserModel = models.User
        let receivedThis: unknown

        class User extends UserModel {
            @adminAction('deactivate', {
                actionType: 'record',
                override: true,
            })
            public static async deactivate(this: unknown) {
                receivedThis = this

                return {}
            }
        }

        const ParentUser = User
        class ChildUser extends ParentUser {}

        const definition = buildResourceDefinition(ChildUser)
        const action = definition.options.actions!.deactivate

        await action.handler!({} as any, {} as any, {} as any)

        assert.strictEqual(receivedThis, ChildUser)
        assert.notProperty(action, 'override')
        assert.notProperty(action, 'name')
    })

    test('keeps inherited filter metadata available without rebinding it during provider materialization', ({
        assert,
        models,
    }) => {
        const UserModel = models.User

        class User extends UserModel {
            @adminFilter('phoneNumber')
            public static async filterByPhoneNumber() {
                return () => {}
            }
        }

        const ParentUser = User
        class ChildUser extends ParentUser {}

        buildResourceDefinition(ChildUser)

        assert.strictEqual(
            ChildUser.$adminFilters!.phoneNumber.resolve,
            ParentUser.$adminFilters!.phoneNumber.resolve
        )
    })
})
