/**
 * Author: G@mOBEP
 * Date: 26.12.12
 * Time: 20:44
 *
 * Swift - MVC-фреймворк на основе Express.
 */

var $express = require('express'),
    $path = require('path'),

    $swiftUtils = require('swift.utils'),

    fsUtil = $swiftUtils.fs,
    packageUtil = $swiftUtils.package,
    typeUtil = $swiftUtils.type,

    Configurator = require('./core/configurator').Configurator,
    Router = require('./core/router').Router,
    Server = require('./core/server').Server,
    Modules = require('swift.modules').Modules,
    DbManager = require('swift.db').DbManager,
    HelperManager = require('./core/helperManager').HelperManager;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Swift = Swift;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Swift ()
{
    this._pathToAppConfig = null;

    this.express       = $express;
    this.app           = null;
    this.config        = null;
    this.server        = new Server();
    this.modules       = new Modules();
    this.router        = new Router();
    this.dbManager     = new DbManager();
    this.helperManager = new HelperManager();
    this.utils         = packageUtil.requireDirRSync(__dirname + '/utils');
}

/**
 * Задание пути к файлу конфигурации приложения
 *
 * @param {String} pathToAppConfig путь к файлу конфигурации приложения
 *
 * @returns {Swift}
 */
Swift.prototype.setPathToAppConfig = function setPathToAppConfig (pathToAppConfig)
{
    this._pathToAppConfig = pathToAppConfig;

    return this;
};

/**
 * Инициализация
 *
 * @param {String} pathToAppConfig путь к файлу конфигурации приложения
 *
 * @returns {Swift}
 */
Swift.prototype.init = function init (pathToAppConfig)
{
    if (this.app) return this;

    if (typeof pathToAppConfig === 'string') this.setPathToAppConfig(pathToAppConfig);

    var app = this.app = $express(),
        configurator  = new Configurator(),
        router        = this.router,
        server        = this.server,
        modules       = this.modules,
        dbManager     = this.dbManager,
        helperManager = this.helperManager,

        pathToSysConfigFile = fsUtil.getExistingPath([
            __dirname + '/config.json',
            __dirname + '/config.js'
        ]),
        pathToAppConfigDirDef = $path.normalize(__dirname + '/../../../app/config'),
        pathToAppConfigFile = this._pathToAppConfig || fsUtil.getExistingPath([
            pathToAppConfigDirDef + '/config.json',
            pathToAppConfigDirDef + '/config.js'
        ]),
        pathToAppConfigDir = $path.dirname(pathToAppConfigFile),
        pathToRoutesFile = fsUtil.getExistingPath([
            pathToAppConfigDir + '/routes.json',
            pathToAppConfigDir + '/routes.js'
        ]),
        pathToRoutesDir = $path.dirname(pathToRoutesFile),

        sysConfigSrc = require(pathToSysConfigFile),
        appConfigSrc = require(pathToAppConfigFile),
        config,
        routesSrc = require(pathToRoutesFile),
        routes,

        __endvars__;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация конфигурации
    //

    this.config = config = configurator
        .compile(appConfigSrc)
        .complete(configurator.extend(sysConfigSrc))
        .getConfig()
    ;

    //
    // задание путей
    //

    config.path         = typeof config.path === 'object' ? config.path : {};
    config.path.project = config.path.project || $path.normalize(pathToAppConfigDir + '/../..');
    config.path.app     = config.path.app || config.path.project + '/app';
    config.path.modules = config.path.modules || config.path.app + '/modules';
    config.path.config  = $path.dirname(pathToAppConfigDir);
    config.path.swift   = $path.resolve(__dirname + '/..');
    config.path.lib     = $path.resolve(__dirname);

    //
    // задание подсистем
    //

    if (!typeUtil.isObject(config.swift)) config.swift = {};
    if (!typeUtil.isObject(config.swift.use)) config.swift.use = {};
    if (typeof config.swift.use.dbManager !== 'boolean') config.swift.use.dbManager = false;
    if (typeof config.swift.use.helperManager !== 'boolean') config.swift.use.helperManager = false;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация роутера
    //

    routes = router
        .setPathToRequireRoutesDir(pathToRoutesDir)
        .compile(routesSrc)
        .getRoutes()
    ;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация приложения
    //

    app.set('port', process.env.PORT || config.server.port);
    app.set('views', config.path.app + '/view');

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация сервера
    //

    server
        .setRequestListener(app)
        .setIp(config.server.ip)
        .setPort(app.set('port'))
    ;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация набора модулей
    //

    modules
        .setPathToModules(config.path.modules)
        .setRequestListener(app)
        .setServer(server)
    ;

    for (var alias in routes)
    {
        if (!routes.hasOwnProperty(alias)) continue;

        var route          = routes[alias],
            modulName      = route.module,
            controllerName = route.controller,
            actionName     = route.action,
            path           = route.path;

        modules.addRoute(modulName, controllerName, actionName, path);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация БД
    //

    if (config.swift.use.dbManager && typeUtil.isObject(config.db) && typeUtil.isObject(config.db.adapters))
    {
        var cAdapters = config.db.adapters, // параметры адаптеров
            adapterNames = Object.keys(cAdapters).map(function (adapterName) { return adapterName; }), // имена адаптеров
            adapters = dbManager.useAdapters(adapterNames).getAdapters(); // адаптеры

        Object.keys(adapters).forEach(function (adapterName)
        {
            if (!typeUtil.isObject(cAdapters[adapterName]) ||
                !typeUtil.isObject(cAdapters[adapterName].connections)) return;

            var adapter      = adapters[adapterName],  // адаптер
                cAdapter     = cAdapters[adapterName], // параметры адаптера
                cConnections = cAdapter.connections;   // параметры соединений

            Object.keys(cConnections).forEach(function (connectionName)
            {
                var сСonnection = cConnections[connectionName]; // параметры соединения

                if (!typeUtil.isObject(сСonnection)) return;

                adapter.addConectionParams(connectionName, сСonnection);
            });
        });

        dbManager.connect(function (err) { if (err) console.log(err); });
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация хелперов
    //

    if (config.swift.use.helperManager)
    {
        helperManager
            .init({
                routes: routes
            })
        ;
    }

    //
    ////
    //

    return this;
};

/**
 * Подключение ресурса из директории проекта
 *
 * @param {String} path путь к ресурсу
 * @param {Object|Function|undefined} params параметры
 * @param {Function|undefined} cb
 *
 * @return {Swift}
 */
Swift.prototype.require = function require (path, params, cb)
{
    if (typeof params === 'function') cb = params;

    //
    // парсинг токенов
    //

    if(path.indexOf('[') === 0 && path.indexOf(']'))
    {
        var paths = path.split(']');

        path = this.config.path.modules + '/' + paths[0]
            .replace('[', '')
            .split('.')
            .join('/modules/') + paths[1]
        ;
    }
    else if (path.indexOf(':app') === 0) path = path.replace(':app', this.config.path.app);
    else if (path.indexOf(':modules') === 0) path = path.replace(':modules', this.config.path.modules);
    else if (path.indexOf(':config') === 0) path = path.replace(':config', this.config.path.config);
    else if (path.indexOf(':swift') === 0) path = path.replace(':swift', this.config.path.swift);
    else if (path.indexOf(':lib') === 0) path = path.replace(':lib', this.config.path.lib);
    else path = this.config.path.project + '/' + path;

    //
    // подключение ресурса
    //

    if (typeof cb === 'function')
    {
        packageUtil.require(path, params, cb);
        return this;
    }
    else
    {
        return packageUtil.requireSync(path, params);
    }
};