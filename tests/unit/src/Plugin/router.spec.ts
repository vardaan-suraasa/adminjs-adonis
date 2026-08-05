import { Router } from '../../../../src/Plugin/router'
import { test } from '@japa/runner'
import AdminJS, { RouterType } from 'adminjs'
import httpMocks from 'node-mocks-http'
import sinon from 'sinon'

import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

test.group('Router | createRouteHandler', (group) => {
    let ctx: HttpContextContract
    const route: RouterType['routes'][number] = {
        method: 'GET',
        path: '/',
        Controller: class {
            public admin: AdminJS

            constructor({ admin }: { admin: AdminJS }) {
                this.admin = admin
            }

            public test() {}
        },
        contentType: 'text/html',
        action: 'test',
    }
    let admin: AdminJS

    group.each.setup(() => {
        ctx = group.application.container.use('Adonis/Core/HttpContext').create(
            '/',
            {},
            httpMocks.createRequest({
                method: 'GET',
            })
        )
        admin = new AdminJS()
    })

    group.each.teardown(() => {
        sinon.restore()
    })

    test('controller is called and adequate response is sent', async ({
        assert,
        application,
    }) => {
        const router = application.container.make(Router, [
            admin,
            {
                enabled: true,
            },
        ])
        const actionStub = sinon
            .stub(route.Controller.prototype, 'test')
            .returns('Sample HTML Text')
        const responseHeaderSpy = sinon.spy(ctx.response, 'header')
        const responseSendSpy = sinon.spy(ctx.response, 'send')

        const handler = router.createRouteHandler(route)

        assert.isFunction(handler)

        await handler(ctx)

        assert.isTrue(actionStub.calledOnce)
        assert.isTrue(
            responseHeaderSpy.calledWith('content-type', route.contentType)
        )
        assert.isTrue(responseSendSpy.calledOnceWith('Sample HTML Text'))
    })

    test('passes current admin from the guard named in an auth:<guard> middleware', async ({
        assert,
        application,
    }) => {
        const ssoUser = { uuid: 'sso-user' }
        const defaultUser = { uuid: 'default-user' }

        ;(ctx as any).auth = {
            user: defaultUser,
            use: (guard: string) => {
                assert.strictEqual(guard, 'sso')

                return { user: ssoUser }
            },
        }

        const router = application.container.make(Router, [
            admin,
            {
                enabled: true,
                middlewares: ['auth:sso'],
            },
        ])

        let receivedCurrentAdmin: unknown

        class ControllerWithCapture {
            public admin: AdminJS

            constructor(_ctorArgs: { admin: AdminJS }, currentAdmin: unknown) {
                this.admin = _ctorArgs.admin
                receivedCurrentAdmin = currentAdmin
            }

            public test() {
                return 'Sample HTML Text'
            }
        }

        const handler = router.createRouteHandler({
            ...route,
            Controller: ControllerWithCapture,
        })

        await handler(ctx)

        assert.strictEqual(receivedCurrentAdmin, ssoUser)
    })

    test('uses the first guard when auth middleware lists multiple guards', async ({
        assert,
        application,
    }) => {
        const webUser = { uuid: 'web-user' }
        const defaultUser = { uuid: 'default-user' }

        ;(ctx as any).auth = {
            user: defaultUser,
            use: (guard: string) => {
                assert.strictEqual(guard, 'web')

                return { user: webUser }
            },
        }

        const router = application.container.make(Router, [
            admin,
            {
                enabled: true,
                middlewares: ['auth:web,api'],
            },
        ])

        let receivedCurrentAdmin: unknown

        class ControllerWithCapture {
            public admin: AdminJS

            constructor(_ctorArgs: { admin: AdminJS }, currentAdmin: unknown) {
                this.admin = _ctorArgs.admin
                receivedCurrentAdmin = currentAdmin
            }

            public test() {
                return 'Sample HTML Text'
            }
        }

        const handler = router.createRouteHandler({
            ...route,
            Controller: ControllerWithCapture,
        })

        await handler(ctx)

        assert.strictEqual(receivedCurrentAdmin, webUser)
    })

    test('falls back to the default guard when no auth:<guard> middleware is configured', async ({
        assert,
        application,
    }) => {
        const defaultUser = { uuid: 'default-user' }

        ;(ctx as any).auth = { user: defaultUser }

        const router = application.container.make(Router, [
            admin,
            {
                enabled: true,
            },
        ])

        let receivedCurrentAdmin: unknown

        class ControllerWithCapture {
            public admin: AdminJS

            constructor(_ctorArgs: { admin: AdminJS }, currentAdmin: unknown) {
                this.admin = _ctorArgs.admin
                receivedCurrentAdmin = currentAdmin
            }

            public test() {
                return 'Sample HTML Text'
            }
        }

        const handler = router.createRouteHandler({
            ...route,
            Controller: ControllerWithCapture,
        })

        await handler(ctx)

        assert.strictEqual(receivedCurrentAdmin, defaultUser)
    })
})

test.group('Router | createAssetHandler', (group) => {
    let ctx: HttpContextContract
    const asset: RouterType['assets'][number] = {
        path: '/',
        src: 'abc.txt',
    }
    let admin: AdminJS

    group.each.setup(() => {
        ctx = group.application.container
            .use('Adonis/Core/HttpContext')
            .create('/', {})
        admin = new AdminJS()
    })

    group.each.teardown(() => {
        sinon.restore()
    })

    test('controller is called and file is sent', async ({
        assert,
        application,
    }) => {
        const spy = sinon.spy(ctx.response, 'download')
        const router = application.container.make(Router, [
            admin,
            {
                enabled: true,
            },
        ])

        const handler = router.createAssetHandler(asset)

        assert.isFunction(handler)

        await handler(ctx)

        assert.isTrue(spy.calledOnceWith(asset.src))
    })
})

test.group('Router | buildRoutes', (group) => {
    group.each.teardown(() => {
        sinon.restore()
    })

    test('routes are not registered if config is not enabled', ({
        assert,
        application,
    }) => {
        const Route = application.container.use('Adonis/Core/Route')
        const admin = new AdminJS()
        const router = application.container.make(Router, [
            admin,
            {
                enabled: false,
            },
        ])

        const groupStub = sinon.stub(Route, 'group')

        router.buildRoutes()

        assert.isFalse(groupStub.called)
    })

    test('all the routes are successfully registered if config is enabled', ({
        assert,
        application,
    }) => {
        const Route = application.container.use('Adonis/Core/Route')
        const admin = new AdminJS()

        // TODO: find a better solution to this
        const middlewareStub = sinon.stub()
        const prefixStub = sinon.stub().returns({
            middleware: middlewareStub,
        })
        const groupStub = sinon.stub(Route, 'group').returns({
            prefix: prefixStub,
            middleware: middlewareStub,
        } as any)
        const config = {
            enabled: true,
            routePrefix: '/admin123',
            middlewares: ['abc123'],
        }
        const router = application.container.make(Router, [admin, config])

        router.buildRoutes()

        assert.isTrue(groupStub.calledOnce)
        assert.isTrue(prefixStub.calledOnceWith(config.routePrefix))
        assert.isTrue(middlewareStub.calledOnceWith(config.middlewares))

        const methodStub = sinon.stub()
        ;(['get', 'put', 'post', 'patch', 'delete'] as const).forEach(
            (method) => {
                sinon.replace(Route, method, methodStub)
            }
        )

        // call the callback provided to the group method
        groupStub.args[0][0]()

        assert.isTrue(methodStub.called)
    })
})
