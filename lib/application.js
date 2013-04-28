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
    $cliColor = require('cli-color'),
    $swiftUtils = require('swift.utils'),

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
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw new ApplicationError()
    .setMessage('Возникла ошибка при подключении менеджера баз данных (ответ node: ' + e.message + ')')
    .setDetails(e)
    .setCode(ApplicationError.codes.REQUIRE_DB_MANAGER_ERROR); }
try { HelperManager = require('swift.helpers').HelperManager; }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw new ApplicationError()
    .setMessage('Возникла ошибка при подключении менеджера помощников (ответ node: ' + e.message + ')')
    .setDetails(e)
    .setCode(ApplicationError.codes.REQUIRE_HELPER_MANAGER_ERROR); }
try { LoggerManager = require('swift.logger').LoggerManager; }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw new ApplicationError()
    .setMessage('Возникла ошибка при подключении менеджера логгеров (ответ node: ' + e.message + ')')
    .setDetails(e)
    .setCode(ApplicationError.codes.REQUIRE_LOGGER_MANAGER_ERROR); }

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
     * Отключение логирования запуска приложения
     *
     * @type {Boolean}
     * @private
     */
    this._disableLog = false;

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
     * @type {Object}
     */
    this.expressApp = null;

    /**
     * Конфигуратор приложения
     *
     * @type {Configurator}
     */
    this.configurator = new Configurator();

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
     * Маршрутизатор
     *
     * @type {Router}
     */
    this.router = new Router();

    /**
     * Менеджер модулей
     *
     * @type {ModuleManager}
     */
    this.moduleManager = new ModuleManager();

    /**
     * Менеджер баз данных
     *
     * @type {DbManager|null}
     */
    this.dbManager = null;

    /**
     * Менеджер помощников
     *
     * @type {HelperManager|null}
     */
    this.helperManager = null;

    /**
     * Менеджер логгеров
     *
     * @type {LoggerManager|null}
     */
    this.loggerManager = null;

    //
    ////
    //

    this.moduleManager.$swift = function $swift () { return self; };
    if (DbManager !== null) (this.dbManager = new DbManager()).$swift = function $swift () { return self; };
    if (HelperManager !== null) (this.helperManager = new HelperManager()).$swift = function $swift () { return self; };
    if (LoggerManager !== null) (this.loggerManager = new LoggerManager()).$swift = function $swift () { return self; };
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
 * Получение пути к файлу конфигурации приложения
 *
 * @returns {String}
 */
Application.prototype.getPathToAppConfig = function getPathToAppConfig ()
{
    return this._pathToAppConfig;
};

/**
 * Отключение логирования запуска приложения
 *
 * @returns {*}
 */
Application.prototype.disableLog = function disableLog ()
{
    this._disableLog = true;

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

    //
    // проверка статуса приложения
    //

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

    //
    ////
    //

    if (!this._disableLog)
    {
        console.log('');
        console.log($cliColor.bold('Инициализация приложения'));
    }

    this.expressApp = $express();

    var pathToSysConfigFile,
        pathToAppConfigDir,
        pathToAppConfigFile,
        sysConfigSrc,
        appConfigSrc,
        config,

        routesSrc,
        routes,

        errors = [];

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация конфигуратора
    //

    if (typeof pathToAppConfig === 'string')
    {
        try { this.setPathToAppConfig(pathToAppConfig); }
        catch (e) { errors.push(e); }
    }

    try
    {
        pathToSysConfigFile = $swiftUtils.fs.getExistingPath([
            __dirname + '/config.json',
            __dirname + '/config.js'
        ]);
        pathToAppConfigFile = this._pathToAppConfig || $swiftUtils.fs.getExistingPath([
            $path.normalize(__dirname + '/../../../app/config') + '/config.json',
            $path.normalize(__dirname + '/../../../app/config') + '/config.js'
        ]);
        pathToAppConfigDir = $path.dirname(pathToAppConfigFile);

        sysConfigSrc = require(pathToSysConfigFile);
        appConfigSrc = require(pathToAppConfigFile);
        config = this.configurator
            .compile(appConfigSrc)
            .complete(this.configurator.extend(sysConfigSrc))
            .getConfig()
        ;

        if (!this._disableLog) console.log(' - инициализация конфигуратора: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация конфигуратора: ' + $cliColor.red.bold('не выполнена'));
            console.log($cliColor.red(e.message));
        }
        errors.push(e);
    }

    //
    // задание предустановленных параметров конфигурации
    //

    config                    = config || {};
    config.swift              = $swiftUtils.type.isObject(config.swift) ? config.swift : {};

    config.swift.path         = $swiftUtils.type.isObject(config.swift.path) ? config.swift.path : {};
    config.swift.path.config  = pathToAppConfigFile;

    config.swift.server       = $swiftUtils.type.isObject(config.swift.server) ? config.swift.server : {};
    config.swift.server.ip    = config.swift.server.ip || '127.0.0.1';
    config.swift.server.port  = config.swift.server.port || '3333';

    //
    // задание пути к директории проекта
    //

    if (config.swift.path.project)
    {
        var pathToProjectArr = config.swift.path.project.split('/');

        if (pathToProjectArr[0] === '.') pathToProjectArr[0] = pathToAppConfigDir;
        else if (pathToProjectArr[0] === '..') pathToProjectArr[0] = pathToAppConfigDir + '/..';

        config.swift.path.project = $path.normalize(pathToProjectArr.join('/'));
    }
    else config.swift.path.project = $path.normalize(pathToAppConfigDir + '/../..');

    //
    // задание пути к директории приложения
    //

    if (config.swift.path.app)
    {
        var pathToAppArr = config.swift.path.app.split('/');

        if (pathToAppArr[0] === '.') pathToAppArr[0] = pathToAppConfigDir;
        else if (pathToAppArr[0] === '..') pathToAppArr[0] = pathToAppConfigDir + '/..';

        config.swift.path.app = $path.normalize(pathToAppArr.join('/'));
    }
    else config.swift.path.app = config.swift.path.project + '/app';

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // задание параметров приложения 'Express'
    //

    this.expressApp.set('port', this.expressApp.set('port') || process.env.PORT || config.swift.server.port);
    this.expressApp.set('views', config.swift.path.app + '/view');

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация роутера
    //

    try
    {
        if (config.swift.path.routes)
        {
            var pathToRoutesFileArr = config.swift.path.routes.split('/');

            if (pathToRoutesFileArr[0] === '.') pathToRoutesFileArr[0] = pathToAppConfigDir;
            else if (pathToRoutesFileArr[0] === '..') pathToRoutesFileArr[0] = pathToAppConfigDir + '/..';

            config.swift.path.routes = $path.normalize(pathToRoutesFileArr.join('/'));
        }
        else config.swift.path.routes = $swiftUtils.fs.getExistingPath([
            pathToAppConfigDir + '/routes.json',
            pathToAppConfigDir + '/routes.js'
        ]);

        routesSrc = require(config.swift.path.routes);
        routes = this.router
            .setPathToRequireRoutesDir($path.dirname(config.swift.path.routes))
            .compile(routesSrc)
            .getRoutes()
        ;

        if (!this._disableLog) console.log(' - инициализация роутера: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация роутера: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
        }
        errors.push(e);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера модулей
    //

    try
    {
        if (config.swift.path.modules)
        {
            var pathToModulesArr = config.swift.path.modules.split('/');

            if (pathToModulesArr[0] === '.') pathToModulesArr[0] = pathToAppConfigDir;
            else if (pathToModulesArr[0] === '..') pathToModulesArr[0] = pathToAppConfigDir + '/..';

            config.swift.path.modules = $path.normalize(pathToModulesArr.join('/'));
        }
        else config.swift.path.modules = config.swift.path.app + '/modules';

        this.moduleManager
            .setPathToModules(config.swift.path.modules)
            .setRequestListener(this.expressApp)
        ;

        if (!this._disableLog) console.log(' - инициализация менеджера модулей: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация менеджера модулей: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
        }
        errors.push(e);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера баз данных
    //

    if (this.dbManager && $swiftUtils.type.isObject(config.swift) && $swiftUtils.type.isObject(config.swift.dbManager) &&
        $swiftUtils.type.isObject(config.swift.dbManager.adapters))
    {
        try
        {
            var cAdapters = config.swift.dbManager.adapters, // параметры адаптеров
                adapters  = this.dbManager.getAllAdapters(); // адаптеры

            for (var adapterName in adapters)
            {if (!adapters.hasOwnProperty(adapterName)) continue;

                if (!$swiftUtils.type.isObject(cAdapters[adapterName]) ||
                    !$swiftUtils.type.isObject(cAdapters[adapterName].connections)) continue;

                var adapter      = adapters[adapterName],  // адаптер
                    cAdapter     = cAdapters[adapterName], // параметры адаптера
                    cConnections = cAdapter.connections;   // параметры соединений

                for (var connectionName in cConnections)
                {if (!cConnections.hasOwnProperty(connectionName)) continue;

                    var cConnection = cConnections[connectionName]; // параметры соединения

                    if (!$swiftUtils.type.isObject(cConnection)) continue;

                    adapter.addConectionParams(connectionName, cConnection);
                }
            }

            if (!this._disableLog)
                console.log(' - инициализация менеджера баз данных: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            if (!this._disableLog)
            {
                console.log(' - инициализация менеджера баз данных: ' + $cliColor.red.bold('не выполнена'));
                console.log('   ' + $cliColor.red(e.message));
            }
            errors.push(e);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация менеджера логгеров
    //

    if (this.loggerManager && $swiftUtils.type.isObject(config.swift) &&
        $swiftUtils.type.isObject(config.swift.loggerManager) &&
        $swiftUtils.type.isObject(config.swift.loggerManager.loggers))
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

                        if (pathToLogArr[0] === '.') pathToLogArr[0] = config.swift.path.project;
                        else if (pathToLogArr[0] === '..') pathToLogArr[0] = config.swift.path.project + '/..';

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

            if (!this._disableLog)
                console.log(' - инициализация менеджера логгеров: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            if (!this._disableLog)
            {
                console.log(' - инициализация менеджера логгеров: ' + $cliColor.red.bold('не выполнена'));
                console.log('   ' + $cliColor.red(e.message));
            }
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

            if (!this._disableLog)
                console.log(' - инициализация менеджера помощников: ' + $cliColor.green.bold('выполнена'));
        }
        catch (e)
        {
            if (!this._disableLog)
            {
                console.log(' - инициализация менеджера помощников: ' + $cliColor.red.bold('не выполнена'));
                console.log('   ' + $cliColor.red(e.message));
            }
            errors.push(e);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Инициализация сервера
    //

    try
    {
        this.server
            .setRequestListener(this.expressApp)
            .setIp(config.swift.server.ip)
            .setPort(this.expressApp.set('port'))
        ;

        for (var alias in routes)
        {
            if (!routes.hasOwnProperty(alias)) continue;

            var route          = routes[alias],
                modulName      = route.module,
                controllerName = route.controller,
                actionName     = route.action,
                path           = route.path;

            this.moduleManager.addRoute(modulName, controllerName, actionName, path);
        }

        if (!this._disableLog) console.log(' - инициализация сервера: ' + $cliColor.green.bold('выполнена'));
    }
    catch (e)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация сервера: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(e.message));
        }
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

    cb(null, this.expressApp);
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

        config = this.configurator.getConfig(),

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

    if (!this._disableLog)
    {
        console.log('');
        console.log($cliColor.bold('Запуск приложения'));
    }

    //
    // соединение с БД
    //

    function connectDb ()
    {
        if (self.dbManager !== null && $swiftUtils.type.isObject(config.swift.dbManager))
        {
            dbAdapters = self.dbManager.getAllAdapters();

            if (Object.keys(dbAdapters).length)
            {
                if (!self._disableLog) console.log(' - установление соединений с БД:');

                for (var adapterName in dbAdapters)
                {if (!dbAdapters.hasOwnProperty(adapterName)) continue;

                    var adapter = dbAdapters[adapterName],
                        allConnectionParams = adapter.getAllConnectionParams();

                    if (!Object.keys(allConnectionParams).length) continue;

                    if (!self._disableLog) console.log('    адаптер "' + $cliColor.blue.bold(adapterName) + '":');

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
                                    if (!self._disableLog)
                                    {
                                        console.log('     соединение "' + $cliColor.blue.bold(connectionName) +
                                            '" (' + connectionParams.uri + '): ' + $cliColor.red.bold('ошибка'));
                                        console.log('     ' + $cliColor.red(err.message));
                                    }
                                    errors.push(err);
                                    dbThreads--;
                                    return;
                                }

                                if (!self._disableLog)
                                    console.log('     соединение "' + $cliColor.blue.bold(connectionName) +
                                        '" (' + connectionParams.uri + '): ' + $cliColor.green.bold('установлено'));
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
        if (this.loggerManager !== null && $swiftUtils.type.isObject(config.swift.loggerManager))
        {
            loggers = self.loggerManager.getAllLoggers();

            if (Object.keys(loggers).length)
            {
                if (!self._disableLog) console.log(' - запуск логгеров:');

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
                                if (!self._disableLog)
                                {
                                    console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                        '" (' + logger.getPathToLog() + '): ' + $cliColor.red.bold('ошибка'));
                                    console.log('    ' + $cliColor.red(err.message));
                                }
                                errors.push(err);
                                loggersThreads--;
                                return;
                            }

                            if (!self._disableLog)
                                console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                    '" (' + logger.getPathToLog() + '): ' + $cliColor.green.bold('запущен'));
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
            if (!self._disableLog) console.log(' - запуск модулей:');

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
                            if (!self._disableLog)
                            {
                                console.log('    модуль "' + $cliColor.blue.bold(moduleName) +
                                    '" (' + modul.getPathToModule() + '): ' + $cliColor.red.bold('ошибка'));
                                if ($swiftUtils.type.isArray(err))
                                    err.forEach(function (err) { console.log($cliColor.red('    ' + err.message)); });
                                else console.log($cliColor.red('    ' + err.message));
                            }
                            errors.push(err);
                            modulesThreads--;
                            return;
                        }

                        if (!self._disableLog)
                            console.log('    модуль "' + $cliColor.blue.bold(moduleName) +
                                '" (' + modul.getPathToModule() + '): ' + $cliColor.green.bold('запущен'));
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
        if (!self._disableLog) console.log(' - запуск сервера:');

        self.server.run(function (err)
        {
            if (err)
            {
                if (!self._disableLog)
                {
                    console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':' +
                        self.server.getPort()) + '): ' +  $cliColor.red.bold('ошибка'));
                    console.log($cliColor.red('    ' + err.message));
                }
                errors.push(err);
                cb(errors);
                return;
            }

            if (!self._disableLog)
            {
                console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':'
                    + self.server.getPort()) + '): ' +  $cliColor.green.bold('запущен'));
                console.log('');
                console.log('------------------------------------------------');
                console.log('');
            }

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
    var config = this.configurator.getConfig();

    if (typeof params === 'function') cb = params;

    //
    // парсинг токенов
    //

    if(path.indexOf('[') === 0 && path.indexOf(']'))
    {
        var paths = path.split(']');

        path = config.swift.path.modules + '/' + paths[0]
            .replace('[', '')
            .split('.')
            .join('/modules/') + paths[1]
        ;
    }
    else if (path.indexOf(':app') === 0) path = path.replace(':app', config.swift.path.app);
    else if (path.indexOf(':modules') === 0) path = path.replace(':modules', config.swift.path.modules);
    else if (path.indexOf(':config') === 0) path = path.replace(':config', config.swift.path.config);
    else if (path.indexOf(':swift') === 0) path = path.replace(':swift', config.swift.path.swift);
    else if (path.indexOf(':lib') === 0) path = path.replace(':lib', config.swift.path.lib);
    else path = config.swift.path.project + '/' + path;

    //
    // подключение ресурса
    //

    if (typeof cb === 'function')
    {
        $swiftUtils.package.require(path, params, cb);
        return this;
    }
    else
    {
        return $swiftUtils.package.requireSync(path, params);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Application = Application;