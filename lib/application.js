/**
 * Author: G@mOBEP
 * Date: 26.12.12
 * Time: 20:44
 *
 * Swift - MVC-фреймворк на основе Express.
 */

var $fs = require('fs'),
    $path = require('path'),

    $express = require('express'),

    $swiftUtils = require('swift.utils'),
    $cliColor = require('cli-color'),

    fsUtil = $swiftUtils.fs,
    packageUtil = $swiftUtils.package,
    typeUtil = $swiftUtils.type,

    ApplicationError = require('./errors/applicationError').ApplicationError,

    Configurator = require('./configurator').Configurator,
    Router = require('./router').Router,
    Server = require('./server').Server,
    ModuleManager = require('swift.modules').ModuleManager,
    DbManager = null,
    HelperManager = null,
    LoggerManager = null,

    immediate = typeof setImmediate === 'function' ? setImmediate : process.nextTick;

try { DbManager = require('swift.db').DbManager; }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.log(e); }
try { HelperManager = require('swift.helpers').HelperManager; }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.log(e); }
try { LoggerManager = require('swift.logger').LoggerManager; }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.log(e); }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Application ()
{
    var self = this;

    /**
     * Путь к файлу конфигурации приложения
     *
     * @type {String}
     * @private
     */
    this._pathToAppConfig = null;

    /**
     * Флаг указывающий что приложение проинициализировано
     *
     * @type {Boolean}
     * @private
     */
    this._isInit = false;

    /**
     * Флаг указывающий что производится инициализация приложения
     *
     * @type {Boolean}
     * @private
     */
    this._initExecute = false;

    /**
     * Флаг указывающий что приложение запущено
     *
     * @type {Boolean}
     * @private
     */
    this._isRun = false;

    /**
     * Флаг указывающий что производится запуск приложения
     *
     * @type {Boolean}
     * @private
     */
    this._runExecute = false;

    /**
     * Модуль "Express"
     *
     * @type {*}
     */
    this.express = $express;

    /**
     * Приложение "Express"
     *
     * @type {*}
     */
    this.app = null;

    /**
     * Конфигурация приложения
     *
     * @type {Object}
     */
    this.config = null;

    /**
     * Модуль "swift.utils"
     *
     * @type {Object}
     */
    this.utils = $swiftUtils;

    /**
     * Сервер
     *
     * @type {Server}
     */
    this.server = new Server();

    /**
     * Менеджер модулей
     *
     * @type {ModuleManager}
     */
    this.moduleManager = new ModuleManager();

    /**
     * Маршрутизатор
     *
     * @type {Router}
     */
    this.router        = new Router();

    if (DbManager !== null) (this.dbManager = new DbManager()).$swift = function $swift () { return self; };
    if (HelperManager !== null) (this.helperManager = new HelperManager()).$swift = function $swift () { return self; };
    if (LoggerManager !== null) (this.loggerManager = new LoggerManager()).$swift = function $swift () { return self; };

    //
    ////
    //

    this.moduleManager.$swift = function $swift () { return self; };
}

/**
 * Задание пути к файлу конфигурации приложения
 *
 * @param {String} pathToAppConfig путь к файлу конфигурации приложения
 *
 * @returns {Application}
 */
Application.prototype.setPathToAppConfig = function setPathToAppConfig (pathToAppConfig)
{
    if (typeof pathToAppConfig !== 'string' || !pathToAppConfig.length) throw new ApplicationError()
        .setMessage('Не удалось задать путь к конфигурации приложения. Путь не передан или представлен в недопустимом формате')
        .setCode(ApplicationError.codes.BAD_PATH_TO_APPLICATION_CONFIG);
    if (!$swiftUtils.fs.existsSync(pathToAppConfig) || !$fs.statSync(pathToAppConfig).isFile())
        throw new ApplicationError()
            .setMessage('Не удалось задать путь к конфигурации приложения. Файл (' + pathToAppConfig + ') не найден')
            .setCode(ApplicationError.codes.APPLICATION_CONFIG_FILE_NOT_FOUND);

    this._pathToAppConfig = pathToAppConfig;

    return this;
};

/**
 * Инициализация
 *
 * @param {String|Function} pathToAppConfig путь к файлу конфигурации приложения
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.init = function init (pathToAppConfig, cb)
{
    if (typeof pathToAppConfig === 'function')
    {
        cb = pathToAppConfig;
        pathToAppConfig = null;
    }

    if (typeof cb !== 'function') cb = function(){};

    if (this._isRun)
    {
        cb(new ApplicationError()
            .setMessage('Не удалось проинициализировать приложение. Приложение уже запущено')
            .setCode(ApplicationError.codes.APPLICATION_ALREADY_RUNNING), null);
        return this;
    }
    if (this._isInit)
    {
        cb(new ApplicationError()
            .setMessage('Не удалось проинициализировать приложение. Приложение уже проинициализировано')
            .setCode(ApplicationError.codes.APPLICATION_NOT_INIT), null);
        return this;
    }

    this._initExecute = true;

    console.log('');
    console.log($cliColor.bold('Инициализация приложения'));

    this.app = $express();

    var self = this,

        app           = this.app,
        configurator  = new Configurator(),
        router        = this.router,
        server        = this.server,
        moduleManager = this.moduleManager,

        pathToSysConfigFile,
        pathToAppConfigDirDef = $path.normalize(__dirname + '/../../../app/config'),
        pathToAppConfigDir,
        pathToAppConfigFile,
        pathToRoutesDir,
        pathToRoutesFile,
        sysConfigSrc,
        appConfigSrc,
        config,
        routesSrc,
        routes,

        errors = [];

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    if (typeof pathToAppConfig === 'string')
    {
        try { this.setPathToAppConfig(pathToAppConfig); }
        catch (e) { errors.push(e); }
    }

    pathToSysConfigFile = fsUtil.getExistingPath([
        __dirname + '/config.json',
        __dirname + '/config.js'
    ]);
    pathToAppConfigFile = this._pathToAppConfig || fsUtil.getExistingPath([
        pathToAppConfigDirDef + '/config.json',
        pathToAppConfigDirDef + '/config.js'
    ]);
    pathToAppConfigDir = $path.dirname(pathToAppConfigFile);
    pathToRoutesFile = fsUtil.getExistingPath([
        pathToAppConfigDir + '/routes.json',
        pathToAppConfigDir + '/routes.js'
    ]);
    pathToRoutesDir = $path.dirname(pathToRoutesFile);
    sysConfigSrc = require(pathToSysConfigFile);
    appConfigSrc = require(pathToAppConfigFile);
    routesSrc    = require(pathToRoutesFile);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация конфигуратора
    //

    try
    {
        this.config = config = configurator
            .compile(appConfigSrc)
            .complete(configurator.extend(sysConfigSrc))
            .getConfig()
        ;

        console.log(' - инициализация конфигуратора: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        console.log(' - инициализация конфигуратора: ' + $cliColor.red.bold('не выполнена'));
        console.log($cliColor.red(e.message));
        errors.push(e);
    }

    //
    // задание предустановленных параметров конфигурации
    //

    config                   = config || {};

    config.path              = $swiftUtils.type.isObject(config.path) ? config.path : {};
    config.path.project      = config.path.project || $path.normalize(pathToAppConfigDir + '/../..');
    config.path.app          = config.path.app || config.path.project + '/app';
    config.path.modules      = config.path.modules || config.path.app + '/modules';
    config.path.config       = $path.dirname(pathToAppConfigDir);
    config.path.swift        = $path.normalize(__dirname + '/..');
    config.path.lib          = $path.normalize(__dirname);

    config.swift             = $swiftUtils.type.isObject(config.swift) ? config.swift : {};
    config.swift.server      = $swiftUtils.type.isObject(config.swift.server) ? config.swift.server : {};
    config.swift.server.ip   = config.swift.server.ip || '127.0.0.1';
    config.swift.server.port = config.swift.server.port || '3333';

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // задание параметров приложения приложения
    //

    app.set('port', app.set('port') || process.env.PORT || config.swift.server.port);
    app.set('views', config.path.app + '/view');

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация роутера
    //

    try
    {
        routes = router
            .setPathToRequireRoutesDir(pathToRoutesDir)
            .compile(routesSrc)
            .getRoutes()
        ;

        console.log(' - инициализация роутера: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        console.log(' - инициализация роутера: ' + $cliColor.red.bold('не выполнена'));
        console.log('   ' + $cliColor.red(e.message));
        errors.push(e);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера модулей
    //

    try
    {
        moduleManager
            .setPathToModules(config.path.modules)
            .setRequestListener(app)
        ;

        console.log(' - инициализация менеджера модулей: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        console.log(' - инициализация менеджера модулей: ' + $cliColor.red.bold('не выполнена'));
        console.log('   ' + $cliColor.red(e.message));
        errors.push(e);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера баз данных
    //

    if (this.dbManager && typeUtil.isObject(config.swift) && typeUtil.isObject(config.swift.dbManager) &&
        typeUtil.isObject(config.swift.dbManager.adapters))
    {
        try
        {
            var cAdapters = config.swift.dbManager.adapters, // параметры адаптеров
                adapters  = this.dbManager.getAllAdapters(); // адаптеры

            for (var adapterName in adapters)
            {if (!adapters.hasOwnProperty(adapterName)) continue;

                if (!typeUtil.isObject(cAdapters[adapterName]) ||
                    !typeUtil.isObject(cAdapters[adapterName].connections)) continue;

                var adapter      = adapters[adapterName],  // адаптер
                    cAdapter     = cAdapters[adapterName], // параметры адаптера
                    cConnections = cAdapter.connections;   // параметры соединений

                for (var connectionName in cConnections)
                {if (!cConnections.hasOwnProperty(connectionName)) continue;

                    var cConnection = cConnections[connectionName]; // параметры соединения

                    if (!typeUtil.isObject(cConnection)) continue;

                    adapter.addConectionParams(connectionName, cConnection);
                }
            }

            console.log(' - инициализация менеджера баз данных: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            console.log(' - инициализация менеджера баз данных: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
            errors.push(e);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера логгеров
    //

    if (this.loggerManager && typeUtil.isObject(config.swift) && typeUtil.isObject(config.swift.loggerManager) &&
        typeUtil.isObject(config.swift.loggerManager.loggers))
    {
        try
        {
            var cLoggers = config.swift.loggerManager.loggers;

            for (var loggerName in cLoggers)
            {
                if (!cLoggers.hasOwnProperty(loggerName)) continue;

                var cLogger = cLoggers[loggerName];
                if (!$swiftUtils.type.isObject(cLogger)) cLogger = {};

                try
                {
                    var logger = this.loggerManager
                        .createLogger(loggerName)
                        .getLogger(loggerName);

                    if (typeof cLogger.path !== 'undefined')
                    {
                        var pathToLogArr = cLogger.path.split('/'),
                            pathToLog;

                        if (pathToLogArr[0] === '.') pathToLogArr[0] = self.config.path.project;
                        else if (pathToLogArr[0] === '..') pathToLogArr[0] = self.config.path.project + '/..';

                        pathToLog = pathToLogArr.join('/');
                        logger.setPathToLog(pathToLog);
                    }
                    if (typeof cLogger.encoding !== 'undefined') logger.setEncoding(cLogger.encoding);
                }
                catch (e)
                {
                    //todo генерация ошибки swiftmvc
                }
            }

            console.log(' - инициализация менеджера логгеров: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            console.log(' - инициализация менеджера логгеров: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
            errors.push(e);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера помощников
    //

    if (this.helperManager)
    {
        try
        {
            this.helperManager.getHelper('url').setRoutes(routes);

            console.log(' - инициализация менеджера помощников: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            console.log(' - инициализация менеджера помощников: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
            errors.push(e);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация сервера
    //

    try
    {
        server
            .setRequestListener(app)
            .setIp(config.swift.server.ip)
            .setPort(app.set('port'))
        ;

        for (var alias in routes)
        {
            if (!routes.hasOwnProperty(alias)) continue;

            var route          = routes[alias],
                modulName      = route.module,
                controllerName = route.controller,
                actionName     = route.action,
                path           = route.path;

            moduleManager.addRoute(modulName, controllerName, actionName, path);
        }

        console.log(' - инициализация сервера: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        console.log(' - инициализация сервера: ' + $cliColor.red.bold('не выполнена'));
        console.log('   ' + $cliColor.red(e.message));
        errors.push(e);
    }

    //
    ////
    //

    if (errors.length)
    {
        cb(errors, null);
        this._initExecute = false;
        this._isInit = true;
        return this;
    }

    cb(null, this.app);
    this._initExecute = false;
    this._isInit = true;
    return this;
};

/**
 * Запуск приложения
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.run = function run (cb)
{
    var self = this,
        dbAdapters,
        loggers,
        modules = this.moduleManager.getAllModules(),

        dbThreads = 0,
        loggersThreads = 0,
        modulesThreads = 0,
        errors = [];

    (function awaiting ()
    {
        immediate(function ()
        {
            if (self._initExecute)
            {
                awaiting();
                return;
            }

            if (self._isRun)
            {
                cb(new ApplicationError()
                    .setMessage('Не удалось запустить приложение. Приложение уже запущено')
                    .setCode(ApplicationError.codes.APPLICATION_ALREADY_RUNNING));
                return;
            }
            if (!self._isInit)
            {
                cb(new ApplicationError()
                    .setMessage('Не удалось запустить приложение. Приложение не проинициализировано')
                    .setCode(ApplicationError.codes.APPLICATION_NOT_INIT));
                return;
            }

            connectDb();
        });
    })();

    this._runExecute = true;

    console.log('');
    console.log($cliColor.bold('Запуск приложения'));

    //
    // соединение с БД
    //

    function connectDb ()
    {
        if (self.dbManager !== null && $swiftUtils.type.isObject(self.config.swift.dbManager))
        {
            dbAdapters = self.dbManager.getAllAdapters();

            if (Object.keys(dbAdapters).length)
            {
                console.log(' - установление соединений с БД:');

                for (var adapterName in dbAdapters)
                {if (!dbAdapters.hasOwnProperty(adapterName)) continue;

                    var adapter = dbAdapters[adapterName],
                        allConnectionParams = adapter.getAllConnectionParams();

                    if (!Object.keys(allConnectionParams).length) continue;

                    console.log('    адаптер "' + $cliColor.blue.bold(adapterName) + '":');

                    for (var connectionName in allConnectionParams)
                    {if (!allConnectionParams.hasOwnProperty(connectionName)) continue;

                        var connectionParams = allConnectionParams[connectionName];

                        dbThreads++;

                        (function (connectionName, connectionParams)
                        {
                            adapter.connectOne(connectionName, function (err)
                            {
                                if (err)
                                {
                                    console.log('     соединение "' + $cliColor.blue.bold(connectionName) + '" (' + connectionParams.uri + '): ' + $cliColor.red.bold('не установлено'));
                                    console.log('     ' + $cliColor.red(err.message));
                                    errors.push(err);
                                    dbThreads--;
                                    return;
                                }

                                console.log('     соединение "' + $cliColor.blue.bold(connectionName) + '" (' + connectionParams.uri + '): ' + $cliColor.green.bold('установлено'));
                                dbThreads--;
                            });
                        })(connectionName, connectionParams);
                    }
                }
            }

            (function awaiting ()
            {
                immediate(function ()
                {
                    if (dbThreads)
                    {
                        awaiting();
                        return;
                    }

                    runLoggers();
                });
            })();
        }
        else runLoggers();
    }

    //
    // запуск логгеров
    //

    function runLoggers ()
    {
        if (this.loggerManager !== null && $swiftUtils.type.isObject(self.config.swift.loggerManager))
        {
            loggers = self.loggerManager.getAllLoggers();

            if (Object.keys(loggers).length)
            {
                console.log(' - запуск логгеров:');

                for (var loggerName in loggers)
                {if (!loggers.hasOwnProperty(loggerName)) continue;

                    (function (loggerName)
                    {
                        var logger = loggers[loggerName];

                        loggersThreads++;

                        logger.run(function (err)
                        {
                            if (err)
                            {
                                console.log('    логгер "' + $cliColor.blue.bold(loggerName) + '" (' + logger.getPathToLog() + '): ' + $cliColor.red.bold('не запущен'));
                                console.log('    ' + $cliColor.red(err.message));
                                errors.push(err);
                                loggersThreads--;
                                return;
                            }

                            console.log('    логгер "' + $cliColor.blue.bold(loggerName) + '" (' + logger.getPathToLog() + '): ' + $cliColor.green.bold('запущен'));
                            loggersThreads--;
                        });
                    })(loggerName);
                }
            }

            (function awaiting ()
            {
                immediate(function ()
                {
                    if (loggersThreads)
                    {
                        awaiting();
                        return;
                    }

                    runModules();
                });
            })();
        }
        else runModules();
    }

    //
    // запуск модулей
    //

    function runModules ()
    {
        if (Object.keys(modules).length)
        {
            console.log(' - запуск модулей:');

            for (var moduleName in modules)
            {
                if (!modules.hasOwnProperty(moduleName)) continue;

                (function (moduleName)
                {
                    var modul = modules[moduleName];

                    modulesThreads++;

                    modules[moduleName].run(function (err)
                    {
                        if (err)
                        {
                            console.log('    модуль "' + $cliColor.blue.bold(moduleName) + '" (' + modul.getPathToModule() + '): ' + $cliColor.red.bold('не запущен'));
                            console.log(err.message);
                            errors.push(err);
                            modulesThreads--;
                            return;
                        }

                        console.log('    модуль "' + $cliColor.blue.bold(moduleName) + '" (' + modul.getPathToModule() + '): ' + $cliColor.green.bold('запущен'));
                        modulesThreads--;
                    });
                })(moduleName);
            }

            (function awaiting ()
            {
                immediate(function ()
                {
                    if (modulesThreads)
                    {
                        awaiting();
                        return;
                    }

                    runServer()
                });
            })();
        }
        else runServer();
    }

    //
    // запуск сервера
    //

    function runServer ()
    {
        console.log(' - запуск сервера:');

        self.server.run(function (err)
        {
            if (err)
            {
                console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':' + self.server.getPort()) + '): ' +  $cliColor.red.bold('не запущен'));
                console.log($cliColor.red(err.message));
                errors.push(err);
                cb(errors);
                return;
            }

            console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':' + self.server.getPort()) + '): ' +  $cliColor.green.bold('запущен'));
            console.log('');
            console.log('------------------------------------------------');
            console.log('');

            if (errors.length)
            {
                cb(errors);
                self._runExecute = false;
                return;
            }

            cb(null);
            self._runExecute = false;
        });
    }

    return this;
};

/**
 * Подключение ресурса из директории проекта
 *
 * @param {String} path путь к ресурсу
 * @param {Object|Function|undefined} params параметры
 * @param {Function|undefined} cb
 *
 * @return {Application}
 */
Application.prototype.require = function require (path, params, cb)
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Application = Application;