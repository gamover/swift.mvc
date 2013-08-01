/**
 * Author: G@mOBEP
 * Date: 26.12.12
 * Time: 20:44
 *
 * Swift - MVC-фреймворк на основе Express.
 */

var $fs = require('fs'),
    $path = require('path'),
    $util = require('util'),
    $events = require('events'),

    $express = require('express'),
    $cliColor = require('cli-color'),
    $async = require('async'),

    $swiftUtils = require('swift.utils'),

    Configurator = require('./configurator').Configurator,
    Router = require('./router').Router,
    Server = require('./server').Server,
    ModuleManager = require('swift.modules').ModuleManager,
    DbManager = null,
    HelperManager = null,
    LoggerManager = null,

    projectDir = $path.dirname(process.mainModule.filename);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// подключение подсистем
//

try
{
    DbManager = require('swift.db').DbManager;
}
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
    {
        throw err;
    }
}
try
{
    HelperManager = require('swift.helpers').HelperManager;
}
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
    {
        throw err;
    }
}
try
{
    LoggerManager = require('swift.logger').LoggerManager;
}
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
    {
        throw err;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Application ()
{
    var self = this;

    /**
     * Путь к файлу конфигурации приложения
     *
     * @type {String|null}
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
     * Модуль "Express"
     *
     * @type {*}
     */
    this.express = $express;

    /**
     * Приложение "Express"
     *
     * @type {Object|null}
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

    /**
     * Пользовательские параметры
     *
     * @type {Object}
     * @private
     */
    this._extra = {};

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    this.moduleManager.$swift = function $swift () { return self; };
    if (DbManager !== null) (this.dbManager = new DbManager()).$swift = function $swift () { return self; };
    if (HelperManager !== null) (this.helperManager = new HelperManager()).$swift = function $swift () { return self; };
    if (LoggerManager !== null) (this.loggerManager = new LoggerManager()).$swift = function $swift () { return self; };
}
$util.inherits(Application, $events.EventEmitter);

/**
 * Задание|получение параметров
 *
 * @param {String} key ключ параметра
 * @param {*} value значение параметра
 *
 * @returns {*}
 */
Application.prototype.extra = function extra (key, value)
{
    if (value != null)
    {
        this._extra[key] = value;
        return this;
    }

    return this._extra[key];
};

/**
 * Задание пути к файлу конфигурации приложения
 *
 * @param {String} path путь к файлу конфигурации приложения
 *
 * @returns {Application}
 */
Application.prototype.setPathToAppConfig = function setPathToAppConfig (path)
{
    this._pathToAppConfig = $path.normalize(path);

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
 * Инициализация приложения
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.init = function init (cb)
{
    try
    {
        var self = this,

            pathToSysConfigFile,
            pathToAppConfigDir,
            pathToAppConfigFile,
            sysConfigSrc,
            appConfigSrc,
            config,
            routes;

        if (!cb)
        {
            cb = function(){};
        }

        this.expressApp = $express();

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация конфигуратора /////////////////////////////////////////////////////////////////////////////////
        //
        // компиляция конфигурации
        //
        pathToSysConfigFile = $swiftUtils.fs.getExistingPath([
            __dirname + '/config.json',
            __dirname + '/config.js'
        ]);
        pathToAppConfigFile = this._pathToAppConfig || $swiftUtils.fs.getExistingPath([
            $path.normalize(projectDir + '/app/config') + '/config.json',
            $path.normalize(projectDir + '/app/config') + '/config.js'
        ]);
        pathToAppConfigDir = $path.dirname(pathToAppConfigFile);

        sysConfigSrc = require(pathToSysConfigFile);
        appConfigSrc = require(pathToAppConfigFile);
        config = this.configurator
            .compile(appConfigSrc)
            .complete(this.configurator.extend(sysConfigSrc))
            .getConfig()
        ;
        //
        // обработка конфигурации
        //
        config                    = config || {};
        config.swift              = config.swift || {};

        config.swift.path         = config.swift.path || {};
        config.swift.path.config  = pathToAppConfigFile;

        config.swift.server       = config.swift.server || {};
        config.swift.server.ip    = config.swift.server.ip || '127.0.0.1';
        config.swift.server.port  = config.swift.server.port || '3333';
        //
        // задание пути к директории проекта
        //
        if (config.swift.path.project)
        {
            var pathToProjectArr = config.swift.path.project.split('/');

            if (pathToProjectArr[0] === '.')
            {
                pathToProjectArr[0] = pathToAppConfigDir;
            }
            else if (pathToProjectArr[0] === '..')
            {
                pathToProjectArr[0] = pathToAppConfigDir + '/..';
            }

            config.swift.path.project = $path.normalize(pathToProjectArr.join('/'));
        }
        else
        {
            config.swift.path.project = $path.normalize(projectDir);
        }
        //
        // задание пути к директории приложения
        //
        if (config.swift.path.app)
        {
            var pathToAppArr = config.swift.path.app.split('/');

            if (pathToAppArr[0] === '.')
            {
                pathToAppArr[0] = pathToAppConfigDir;
            }
            else if (pathToAppArr[0] === '..')
            {
                pathToAppArr[0] = pathToAppConfigDir + '/..';
            }

            config.swift.path.app = $path.normalize(pathToAppArr.join('/'));
        }
        else
        {
            config.swift.path.app = config.swift.path.project + '/app';
        }
        //
        // задание пути к файлу маршрутов
        //
        if (config.swift.path.routes)
        {
            var pathToRoutesFileArr = config.swift.path.routes.split('/');

            if (pathToRoutesFileArr[0] === '.')
            {
                pathToRoutesFileArr[0] = pathToAppConfigDir;
            }
            else if (pathToRoutesFileArr[0] === '..')
            {
                pathToRoutesFileArr[0] = pathToAppConfigDir + '/..';
            }

            config.swift.path.routes = $path.normalize(pathToRoutesFileArr.join('/'));
        }
        else
        {
            config.swift.path.routes = $swiftUtils.fs.getExistingPath([
                pathToAppConfigDir + '/routes.json',
                pathToAppConfigDir + '/routes.js'
            ]);
        }
        //
        // задание пути к директории модулей
        //
        if (config.swift.path.modules)
        {
            var pathToModulesArr = config.swift.path.modules.split('/');

            if (pathToModulesArr[0] === '.')
            {
                pathToModulesArr[0] = config.swift.path.project;
            }
            else if (pathToModulesArr[0] === '..')
            {
                pathToModulesArr[0] = config.swift.path.project + '/..';
            }

            config.swift.path.modules = $path.normalize(pathToModulesArr.join('/'));
        }
        else
        {
            config.swift.path.modules = config.swift.path.app + '/modules';
        }
        //
        // инициализация конфигуратора /////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // задание параметров приложения 'Express' /////////////////////////////////////////////////////////////////////
        //
        this.expressApp.set('port', this.expressApp.set('port') || process.env.PORT || config.swift.server.port);
        this.expressApp.set('views', config.swift.path.app + '/view');
        //
        // задание параметров приложения 'Express' /////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация роутера ///////////////////////////////////////////////////////////////////////////////////////
        //
        routes = this.router
            .setPathToRequireRoutesDir($path.dirname(config.swift.path.routes))
            .compile(require(config.swift.path.routes))
            .getRoutes()
        ;
        //
        // инициализация роутера ///////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация менеджера баз данных //////////////////////////////////////////////////////////////////////////
        //
        if (this.dbManager && config.swift.dbManager && config.swift.dbManager.adapters)
        {
            var cAdapters = config.swift.dbManager.adapters;
            //
            // создание адаптеров
            //
            Object.keys(cAdapters).forEach(function (adapterType)
            {
                var cAdapter = cAdapters[adapterType],
                    cConnections = cAdapter.connections,
                    adapter = self.dbManager.createAdapter(adapterType, adapterType);

                if (!cConnections)
                {
                    return;
                }
                //
                // добавление соединений
                //
                Object.keys(cConnections).forEach(function (connectionName)
                {
                    adapter.createConnection(cConnections[connectionName].uri, connectionName);
                });
            });
        }
        //
        // инициализация менеджера баз данных //////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация менеджера логгеров ////////////////////////////////////////////////////////////////////////////
        //
        if (this.loggerManager && config.swift.loggerManager && config.swift.loggerManager.loggers)
        {
            var cLoggers = config.swift.loggerManager.loggers;

            Object.keys(cLoggers).forEach(function (loggerName)
            {
                var cLogger = cLoggers[loggerName],
                    logger = self.loggerManager.createLogger(loggerName),
                    pathToLogArr;
                //
                // задание пути к лог-файлу
                //
                if (cLogger.path != null)
                {
                    pathToLogArr = cLogger.path.split('/');

                    if (pathToLogArr[0] === '.')
                    {
                        pathToLogArr[0] = config.swift.path.project;
                    }
                    else if (pathToLogArr[0] === '..')
                    {
                        pathToLogArr[0] = config.swift.path.project + '/..';
                    }
                    else if (pathToLogArr[0] !== '/')
                    {
                        pathToLogArr.unshift(config.swift.path.project);
                    }

                    logger.setPathToLog(pathToLogArr.join('/'));
                }
                //
                // задание кодировки
                //
                if (cLogger.encoding != null)
                {
                    logger.setEncoding(cLogger.encoding);
                }
                //
                // деактивация логгера
                //
                if (cLogger.disabled)
                {
                    logger.disable();
                }
            });
        }
        //
        // инициализация менеджера логгеров ////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация менеджера помощников //////////////////////////////////////////////////////////////////////////
        //
        if (this.helperManager)
        {
            this.helperManager.getHelper('url').setRoutes(this.router.getRoutes());
        }
        //
        // инициализация менеджера помощников //////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация менеджера модулей /////////////////////////////////////////////////////////////////////////////
        //
        this.moduleManager
            .setPathToModules(config.swift.path.modules)
            .setRequestListener(this.expressApp)
        ;

        Object.keys(this.router.getRoutes()).forEach(function (alias)
        {
            var route = routes[alias],
                modulName      = route.module,
                controllerName = route.controller,
                actionName     = route.action,
                path           = route.path;

            self.moduleManager.addRoute(modulName, controllerName, actionName, path);
        });
        //
        // инициализация менеджера модулей /////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация сервера ///////////////////////////////////////////////////////////////////////////////////////
        //
        this.server
            .setRequestListener(this.expressApp)
            .setIp(config.swift.server.ip)
            .setPort(this.expressApp.set('port'))
        ;
        //
        // инициализация сервера ///////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // инициализация сервера ///////////////////////////////////////////////////////////////////////////////////////
        //

        cb(null, this.expressApp);
    }
    catch (err)
    {
        cb(err);
    }

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
    try
    {
        var self = this,
            config = this.configurator.getConfig(),
            modules = self.moduleManager.getAllModules();

        if (!cb)
        {
            cb = function(){};
        }

        if (!self._disableLog)
        {
            console.log('');
            console.log($cliColor.bold('Запуск приложения'));
        }

        $async.waterfall([
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // установление соединений с базой данных //////////////////////////////////////////////////////////////////
            //
            function dbConnect (next)
            {
                if (self.dbManager)
                {
                    var dbAdapters = self.dbManager.getAllAdapters();

                    if (Object.keys(dbAdapters).length)
                    {
                        if (!self._disableLog)
                        {
                            console.log(' - установление соединений с БД:');
                        }

                        self.emit('beforeDbConnect');

                        for (var adapterName in dbAdapters)
                        {
                            var dbAdapter,
                                connections;

                            if (!dbAdapters.hasOwnProperty(adapterName))
                            {
                                continue;
                            }

                            dbAdapter = dbAdapters[adapterName];
                            connections = dbAdapter.getAllMongoConnections();

                            if (!Object.keys(connections).length)
                            {
                                continue;
                            }

                            if (!self._disableLog)
                            {
                                console.log('    адаптер "' + $cliColor.blue.bold(adapterName) + '":');
                            }

                            $async.each(Object.keys(connections), function (connectionName, stop)
                            {
                                var connection = connections[connectionName];
                                //
                                // установление соединения с БД
                                //
                                connection.connect(function (err)
                                {
                                    if (err)
                                    {
                                        if (!self._disableLog)
                                        {
                                            console.log('     соединение "' + $cliColor.blue.bold(connectionName) +
                                                '" (' + connection.getUri() + '): ' + $cliColor.red.bold('ошибка'));
                                        }

                                        stop(err);
                                        return;
                                    }

                                    if (!self._disableLog)
                                    {
                                        console.log('     соединение "' + $cliColor.blue.bold(connectionName) +
                                            '" (' + connection.getUri() + '): ' + $cliColor.green.bold('установлено'));
                                    }

                                    stop(null);
                                });
                            }, function (err)
                            {
                                if (!err)
                                {
                                    self.emit('dbConnect');
                                }

                                next(err);
                            });
                        }
                    }

                    return;
                }

                next();
            },
            //
            // установление соединений с базой данных //////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // запуск логгеров /////////////////////////////////////////////////////////////////////////////////////////
            //
            function runLoggers (next)
            {
                if (self.loggerManager && config.swift.loggerManager != null)
                {
                    var loggers = self.loggerManager.getAllLoggers();

                    if (Object.keys(loggers).length)
                    {
                        if (!self._disableLog)
                        {
                            console.log(' - запуск логгеров:');
                        }

                        self.emit('beforeRunLoggers');

                        $async.each(Object.keys(loggers), function (loggerName, stop)
                        {
                            var logger = loggers[loggerName];

                            if (config.swift.loggerManager.loggers != null &&
                                config.swift.loggerManager.loggers[loggerName] &&
                                config.swift.loggerManager.loggers[loggerName].stopped)
                            {
                                if (!self._disableLog)
                                {
                                    console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                        '" (' + logger.getPathToLog() + '): ' + $cliColor.yellow.bold('остановлен'));
                                }

                                stop(null);
                                return;
                            }
                            //
                            // запуск логгера
                            //
                            logger.run(function (err)
                            {
                                if (err)
                                {
                                    if (!self._disableLog)
                                    {
                                        console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                            '" (' + logger.getPathToLog() + '): ' + $cliColor.red.bold('ошибка'));
                                    }

                                    stop(err);
                                    return;
                                }

                                if (!self._disableLog)
                                {
                                    console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                        '" (' + logger.getPathToLog() + '): ' + $cliColor.green.bold('запущен') +
                                        (config.swift.loggerManager.loggers[loggerName].disabled ?
                                            $cliColor.magenta.bold(' (заблокирован)') : ''));
                                }

                                stop(null);
                            });
                        }, function (err)
                        {
                            if (!err)
                            {
                                self.emit('runLoggers');
                            }

                            next(err);
                        });
                    }

                    return;
                }

                next();
            },
            //
            // запуск логгеров /////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // запуск модулей //////////////////////////////////////////////////////////////////////////////////////////
            //
            function runModules (next)
            {
                if (Object.keys(modules).length)
                {
                    if (!self._disableLog)
                    {
                        console.log(' - запуск модулей:');
                    }

                    self.emit('beforeRunModules');

                    $async.each(Object.keys(modules), function (moduleName, stop)
                    {
                        var modul = modules[moduleName];
                        //
                        // запуск модуля
                        //
                        modules[moduleName].run(function (err)
                        {
                            if (err)
                            {
                                if (!self._disableLog)
                                {
                                    console.log('    модуль "' + $cliColor.blue.bold(moduleName) + '" (' +
                                        modul.getPathToModule().replace(config.swift.path.project, '') + '): ' +
                                        $cliColor.red.bold('ошибка'));
                                }

                                stop(err);
                                return;
                            }

                            if (!self._disableLog)
                            {
                                console.log('    модуль "' + $cliColor.blue.bold(moduleName) + '" (' +
                                    modul.getPathToModule().replace(config.swift.path.project, '') + '): ' +
                                    $cliColor.green.bold('запущен'));
                            }

                            stop(null);
                        });
                    }, function (err)
                    {
                        if (!err)
                        {
                            self.emit('runModules');
                        }

                        next(err);
                    });

                    return;
                }

                next();
            },
            //
            // запуск модулей //////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // запуск сервера //////////////////////////////////////////////////////////////////////////////////////////
            //
            function runServer (next)
            {
                if (!self._disableLog)
                {
                    console.log(' - запуск сервера:');
                }

                self.emit('beforeRunServer');

                self.server.run(function (err)
                {
                    if (err)
                    {
                        if (!self._disableLog)
                        {
                            console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':' +
                                self.server.getPort()) + '): ' +  $cliColor.red.bold('ошибка'));
                        }

                        next(err);
                        return;
                    }

                    if (!self._disableLog)
                    {
                        console.log('    сервер (' + $cliColor.blue.bold(self.server.getIp() + ':' +
                            self.server.getPort()) + '): ' +  $cliColor.green.bold('запущен'));
                    }

                    self.emit('runServer');

                    next(null);
                });
            }
            //
            // запуск сервера //////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
        ], function (err)
        {
            if (err)
            {
                cb(err);
                return;
            }

            if (!self._disableLog)
            {
                console.log('');
                console.log('------------------------------------------------');
                console.log('');
            }

            cb(null);
        });
    }
    catch (err)
    {
        cb(err);
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
 * @return {Application|Object}
 */
Application.prototype.require = function require (path, params, cb)
{
    var config = this.configurator.getConfig();

    if (typeof params === 'function')
    {
        cb = params;
        params = {};
    }
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
    else if (path.indexOf(':app') === 0)
    {
        path = path.replace(':app', config.swift.path.app);
    }
    else if (path.indexOf(':modules') === 0)
    {
        path = path.replace(':modules', config.swift.path.modules);
    }
    else if (path.indexOf(':config') === 0)
    {
        path = path.replace(':config', config.swift.path.config);
    }
    else if (path.indexOf(':swift') === 0)
    {
        path = path.replace(':swift', config.swift.path.swift);
    }
    else if (path.indexOf(':lib') === 0)
    {
        path = path.replace(':lib', config.swift.path.lib);
    }
    else
    {
        path = config.swift.path.project + '/' + path;
    }
    //
    // подключение ресурса
    //
    if (typeof cb === 'function')
    {
        $swiftUtils.package.require(path, params, cb);

        return this;
    }

    return $swiftUtils.package.requireSync(path, params);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Application = Application;