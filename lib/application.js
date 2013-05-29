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
    $swiftErrors = require('swift.errors'),
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

try { DbManager = require('swift.db').DbManager; }
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
        throw new $swiftErrors.SystemError('Ошибка подключения менеджера баз данных' +
            ' (' + err.message + ').').setInfo(err);
}
try { HelperManager = require('swift.helpers').HelperManager; }
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
        throw new $swiftErrors.SystemError('Ошибка подключения менеджера помощников' +
            ' (' + err.message + ').').setInfo(err);
}
try { LoggerManager = require('swift.logger').LoggerManager; }
catch (err)
{
    if (err.code !== 'MODULE_NOT_FOUND')
        throw new $swiftErrors.SystemError('Ошибка подключения менеджера логгеров' +
            ' (' + err.message + ').').setInfo(err);
}

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
     * Флаг процесса инициализации подсистем
     *
     * @type {Object}
     * @private
     */
    this._isInit = {
        core:    false, // ядро
        app:     false, // приложение
        db:      false, // БД
        loggers: false, // логгеры
        helpers: false, // помощники
        modules: false, // модули
        server:  false  // сервер
    };

    /**
     * Флаг инициализации подсистем
     *
     * @type {Object}
     * @private
     */
    this._initialized = {
        core:    false, // ядро
        app:     false, // приложение
        db:      false, // БД
        loggers: false, // логгеры
        helpers: false, // помощники
        modules: false, // модули
        server:  false  // сервер
    };

    /**
     * Флаги запущенных подсистем
     *
     * @type {Object}
     * @private
     */
    this._isRun = {
        app:     false, // приложение
        db:      false, // БД
        loggers: false, // логгеры
        modules: false, // модули
        server:  false  // сервер
    };


    /**
     * Флаги процесса запуска подсистем
     *
     * @type {Object}
     * @private
     */
    this._isStartingUp = {
        app:     false, // приложение
        db:      false, // БД
        loggers: false, // логгеры
        modules: false, // модули
        server:  false  // сервер
    };

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
 * Инициализация приложения
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.init = function init (cb)
{
    var self = this,
        errors = [];

    if (!this._disableLog)
    {
        console.log('');
        console.log($cliColor.bold('Инициализация приложения'));
    }

    if (typeof cb !== 'function') cb = function(){};
    //
    // проверка возможности инициализации приложения
    //
    if (this._isInit.app)
    {
        cb(new $swiftErrors.SystemError('Приложение уже проинициализировано.'));
        return this;
    }
    else if (this._initialized.app)
    {
        cb(new $swiftErrors.SystemError('Инициализация приложения уже запущена.'));
        return this;
    }

    this._initialized.app = true;
    //
    // инициализация ядра
    //
    this._initCore(function (err)
    {
        if (err) errors.push(err);
        //
        // инициализация менеджера баз данных
        //
        self.initDbManager(function (err)
        {
            if (err) errors.push(err);
            //
            // инициализация менеджера логгеров
            //
            self.initLoggerManager(function (err)
            {
                if (err) errors.push(err);
                //
                // инициализация менеджера помощников
                //
                self.initHelperManager(function (err)
                {
                    if (err) errors.push(err);
                    //
                    // инициализация менеджера модулей
                    //
                    self.initModuleManager(function (err)
                    {
                        if (err) errors.push(err);
                        //
                        // инициализация сервера
                        //
                        self.initServer(function (err)
                        {
                            if (err) errors.push(err);

                            if (errors.length)
                            {
                                self._initialized.app = false;
                                cb(new $swiftErrors.MultipleError('Ошибки инициализации приложения.').setList(errors));
                                return;
                            }

                            self._isInit.app = true;
                            self._initialized.app = false;
                            cb(null, self.expressApp);
                        });
                    });
                });
            });
        });
    });

    return this;
};

/**
 * Инициализация ядра
 *
 * @param {Function} cb
 *
 * @returns {Application}
 * @private
 */
Application.prototype._initCore = function _initCore (cb)
{
    var pathToSysConfigFile,
        pathToAppConfigDir,
        pathToAppConfigFile,
        sysConfigSrc,
        appConfigSrc,
        config,

        errors = [];

    this.expressApp = $express();

    if (typeof cb !== 'function') cb = function(){};
    //
    // проверка возможности инициализации ядра
    //
    if (this._isInit.core)
    {
        cb(new $swiftErrors.SystemError('Ядро уже проинициализировано.'));
        return this;
    }
    else if (this._initialized.core)
    {
        cb(new $swiftErrors.SystemError('Инициализация ядра уже запущена.'));
        return this;
    }

    this._initialized.core = true;
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // инициализация конфигуратора /////////////////////////////////////////////////////////////////////////////////////
    //
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
    catch (err)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация конфигуратора: ' + $cliColor.red.bold('не выполнена'));
            console.log($cliColor.red(err.message));
        }
        errors.push(err);
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
    //
    // инициализация конфигуратора /////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // задание параметров приложения 'Express' /////////////////////////////////////////////////////////////////////////
    //
    this.expressApp.set('port', this.expressApp.set('port') || process.env.PORT || config.swift.server.port);
    this.expressApp.set('views', config.swift.path.app + '/view');
    //
    // задание параметров приложения 'Express' /////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // инициализация роутера ///////////////////////////////////////////////////////////////////////////////////////////
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

        this.router
            .setPathToRequireRoutesDir($path.dirname(config.swift.path.routes))
            .compile(require(config.swift.path.routes))
        ;

        if (!this._disableLog) console.log(' - инициализация роутера: ' + $cliColor.green.bold('выполнена'));
    }
    catch (err)
    {
        if (!this._disableLog)
        {
            console.log(' - инициализация роутера: ' + $cliColor.red.bold('не выполнена'));
            console.log('   ' + $cliColor.red(err.message));
        }
        errors.push(err);
    }
    //
    // инициализация роутера ///////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    if (errors.length)
    {
        this._initialized.core = false;
        cb(new $swiftErrors.MultipleError('Ошибки инициализации ядра.').setList(errors));
        return this;
    }

    this._isInit.core = true;
    this._initialized.core = false;
    cb(null);

    return this;
};

/**
 * Инициализация менеджера баз данных
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.initDbManager = function initDbManager (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        error = null;

    if (typeof cb !== 'function') cb = function(){};

    if (this.dbManager && $swiftUtils.type.isObject(config.swift) && $swiftUtils.type.isObject(config.swift.dbManager) &&
        $swiftUtils.type.isObject(config.swift.dbManager.adapters))
    {
        //
        // проверка возможности инициализации менеджера баз данных
        //
        if (this._isInit.db)
        {
            cb(new $swiftErrors.SystemError('Менеджер баз данных уже проинициализирован.'));
            return this;
        }
        else if (this._initialized.db)
        {
            cb(new $swiftErrors.SystemError('Инициализация менеджера баз данных уже запущена.'));
            return this;
        }
        else if (this._initialized.core)
        {
            //
            // ожидание завершения инициализации ядра
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (self._initialized.core)
                    {
                        awaiting();
                        return;
                    }
                    //
                    // ядро не проинициализировано
                    //
                    if (!self._initialized.core)
                    {
                        cb(new $swiftErrors.SystemError('Не проинициализировано ядро.'));
                        return;
                    }

                    init();
                });
            })();
        }
        else if (!self._isInit.core)
        {
            //
            // инициализация ядра
            //
            self._initCore(function (err)
            {
                if (err)
                {
                    cb(err);
                    return;
                }

                init();
            });
        }
        else init();
        //
        // инициализация менеджера баз данных
        //
        function init ()
        {
            self._initialized.db = true;

            try
            {
                var cAdapters = config.swift.dbManager.adapters, // параметры адаптеров
                    adapters  = self.dbManager.getAllAdapters(); // адаптеры

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

                if (!self._disableLog)
                    console.log(' - инициализация менеджера баз данных: ' + $cliColor.green.bold('выполнена'));

                self._isInit.db = true;
                self._initialized.db = false;
            }
            catch (err)
            {
                if (!self._disableLog)
                {
                    console.log(' - инициализация менеджера баз данных: ' + $cliColor.red.bold('не выполнена'));
                    console.log('   ' + $cliColor.red(err.message));
                }
                self._initialized.db = false;
                error = new $swiftErrors.SystemError('Ошибка инициализации менеджера баз данных.').setInfo(err);
            }

            cb(error);
        }
    }
    else cb(null);

    return this;
};

/**
 * Инициализация менеджера логгеров
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.initLoggerManager = function initLoggerManager (cb)
{
    var self = this,
        config = this.configurator.getConfig();

    if (typeof cb !== 'function') cb = function(){};

    if (this.loggerManager && $swiftUtils.type.isObject(config.swift) &&
        $swiftUtils.type.isObject(config.swift.loggerManager) &&
        $swiftUtils.type.isObject(config.swift.loggerManager.loggers))
    {
        //
        // проверка возможности инициализации менеджера логгеров
        //
        if (this._isInit.loggers)
        {
            cb(new $swiftErrors.SystemError('Менеджер логгеров уже проинициализирован.'));
            return this;
        }
        else if (this._initialized.loggers)
        {
            cb(new $swiftErrors.SystemError('Инициализация менеджера логгеров уже запущена.'));
            return this;
        }
        else if (this._initialized.core)
        {
            //
            // ожидание завершения инициализации ядра
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (self._initialized.core)
                    {
                        awaiting();
                        return;
                    }
                    //
                    // ядро не проинициализировано
                    //
                    if (!self._initialized.core)
                    {
                        cb(new $swiftErrors.SystemError('Не проинициализировано ядро.'));
                        return;
                    }

                    init();
                });
            })();
        }
        else if (!self._isInit.core)
        {
            //
            // инициализация ядра
            //
            self._initCore(function (err)
            {
                if (err)
                {
                    cb(err);
                    return;
                }

                init();
            });
        }
        else init();
        //
        // инициализация менеджера логгеров
        //
        function init ()
        {
            self._initialized.loggers = true;

            var cLoggers = config.swift.loggerManager.loggers,
                errors = [];

            for (var loggerName in cLoggers)
            {if (!cLoggers.hasOwnProperty(loggerName)) continue;

                var cLogger = cLoggers[loggerName];
                if (!$swiftUtils.type.isObject(cLogger)) cLogger = {};

                try
                {
                    var logger = self.loggerManager
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
                    if (cLogger.disabled) logger.disable();
                }
                catch (err)
                {
                    errors.push(err);
                }
            }

            if (errors.length)
            {
                if (!self._disableLog)
                {
                    console.log(' - инициализация менеджера логгеров: ' + $cliColor.red.bold('не выполнена'));
                    console.log('   ' + $cliColor.red(err.message));
                }
                self._initialized.loggers = false;
                cb(new $swiftErrors.MultipleError('Ошибки инициализации менеджера логгеров.').setList(errors));
                return;
            }

            if (!self._disableLog)
                console.log(' - инициализация менеджера логгеров: ' + $cliColor.green.bold('выполнена'));
            self._isInit.loggers = true;
            self._initialized.loggers = false;
            cb(null);
        }
    }
    else cb(null);

    return this;
};

/**
 * Инициализация менеджера помощников
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.initHelperManager = function initHelperManager (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        error = null;

    if (typeof cb !== 'function') cb = function(){};

    if (self.helperManager)
    {
        //
        // проверка возможности инициализации менеджера помощников
        //
        if (this._isInit.helpers)
        {
            cb(new $swiftErrors.SystemError('Менеджер помощников уже проинициализирован.'));
            return this;
        }
        else if (this._initialized.helpers)
        {
            cb(new $swiftErrors.SystemError('Инициализация менеджера помощников уже запущена.'));
            return this;
        }
        else if (this._initialized.core)
        {
            //
            // ожидание завершения инициализации ядра
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (self._initialized.core)
                    {
                        awaiting();
                        return;
                    }
                    //
                    // ядро не проинициализировано
                    //
                    if (!self._initialized.core)
                    {
                        cb(new $swiftErrors.SystemError('Не проинициализировано ядро.'));
                        return;
                    }

                    init();
                });
            })();
        }
        else if (!self._isInit.core)
        {
            //
            // инициализация ядра
            //
            self._initCore(function (err)
            {
                if (err)
                {
                    cb(err);
                    return;
                }

                init();
            });
        }
        else init();
        //
        // инициализация менеджера помощников
        //
        function init ()
        {
            self._initialized.helpers = true;

            try
            {
                self.helperManager.getHelper('url').setRoutes(self.router.getRoutes());

                if (!self._disableLog)
                    console.log(' - инициализация менеджера помощников: ' + $cliColor.green.bold('выполнена'));
                self._isInit.helpers = true;
                self._initialized.helpers = false;
            }
            catch (err)
            {
                if (!self._disableLog)
                {
                    console.log(' - инициализация менеджера помощников: ' + $cliColor.red.bold('не выполнена'));
                    console.log('   ' + $cliColor.red(err.message));
                }
                self._initialized.helpers = false;
                error = new $swiftErrors.SystemError('Ошибка инициализации менеджера помощников.').setInfo(err);
            }

            cb(error);
        }
    }
    else cb(null);

    return this;
};

/**
 * Инициализация менеджера модулей
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.initModuleManager = function initModuleManager (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        error = null;

    if (typeof cb !== 'function') cb = function(){};
    //
    // проверка возможности инициализации менеджера модулей
    //
    if (this._isInit.modules)
    {
        cb(new $swiftErrors.SystemError('Менеджер модулей уже проинициализирован.'));
        return this;
    }
    else if (this._initialized.modules)
    {
        cb(new $swiftErrors.SystemError('Инициализация менеджера модулей уже запущена.'));
        return this;
    }
    else if (this._initialized.core)
    {
        //
        // ожидание завершения инициализации ядра
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (self._initialized.core)
                {
                    awaiting();
                    return;
                }
                //
                // ядро не проинициализировано
                //
                if (!self._initialized.core)
                {
                    cb(new $swiftErrors.SystemError('Не проинициализировано ядро.'));
                    return;
                }

                init();
            });
        })();
    }
    else if (!self._isInit.core)
    {
        //
        // инициализация ядра
        //
        self._initCore(function (err)
        {
            if (err)
            {
                cb(err);
                return;
            }

            init();
        });
    }
    else init();
    //
    // инициализация менеджера модулей
    //
    function init ()
    {
        self._initialized.modules = true;

        try
        {
            if (config.swift.path.modules)
            {
                var pathToModulesArr = config.swift.path.modules.split('/');

                if (pathToModulesArr[0] === '.') pathToModulesArr[0] = config.swift.path.project;
                else if (pathToModulesArr[0] === '..') pathToModulesArr[0] = config.swift.path.project + '/..';

                config.swift.path.modules = $path.normalize(pathToModulesArr.join('/'));
            }
            else config.swift.path.modules = config.swift.path.app + '/modules';

            self.moduleManager
                .setPathToModules(config.swift.path.modules)
                .setRequestListener(self.expressApp)
            ;

            if (!self._disableLog)
                console.log(' - инициализация менеджера модулей: ' + $cliColor.green.bold('выполнена'));
            self._isInit.modules = true;
            self._initialized.modules = false;
        }
        catch (err)
        {
            if (!self._disableLog)
            {
                console.log(' - инициализация менеджера модулей: ' + $cliColor.red.bold('не выполнена'));
                console.log('   ' + $cliColor.red(err.message));
            }
            self._initialized.modules = false;
            error = new $swiftErrors.SystemError('Ошибка инициализации менеджера модулей.').setInfo(err);
        }

        cb(error);
    }

    return this;
};

/**
 * Инициализация сервера
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.initServer = function initModuleManager (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        routes,
        error = null;

    if (typeof cb !== 'function') cb = function(){};
    //
    // проверка возможности инициализации сервера
    //
    if (this._isInit.server)
    {
        cb(new $swiftErrors.SystemError('Сервер уже проинициализирован.'));
        return this;
    }
    else if (this._initialized.server)
    {
        cb(new $swiftErrors.SystemError('Инициализация сервера уже запущена.'));
        return this;
    }
    else if (this._initialized.core)
    {
        //
        // ожидание завершения инициализации ядра
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (self._initialized.core)
                {
                    awaiting();
                    return;
                }
                //
                // ядро не проинициализировано
                //
                if (!self._initialized.core)
                {
                    cb(new $swiftErrors.SystemError('Не проинициализировано ядро.'));
                    return;
                }

                init();
            });
        })();
    }
    else if (!self._isInit.core)
    {
        //
        // инициализация ядра
        //
        self._initCore(function (err)
        {
            if (err)
            {
                cb(err);
                return;
            }

            init();
        });
    }
    else init();
    //
    // инициализация сервера
    //
    function init ()
    {
        self._initialized.server = true;

        try
        {
            self.server
                .setRequestListener(self.expressApp)
                .setIp(config.swift.server.ip)
                .setPort(self.expressApp.set('port'))
            ;

            routes = self.router.getRoutes();

            for (var alias in routes)
            {
                if (!routes.hasOwnProperty(alias)) continue;

                var route          = routes[alias],
                    modulName      = route.module,
                    controllerName = route.controller,
                    actionName     = route.action,
                    path           = route.path;

                self.moduleManager.addRoute(modulName, controllerName, actionName, path);
            }

            if (!self._disableLog) console.log(' - инициализация сервера: ' + $cliColor.green.bold('выполнена'));
            self._isInit.server = true;
            self._initialized.server = false;
        }
        catch (err)
        {
            if (!self._disableLog)
            {
                console.log(' - инициализация сервера: ' + $cliColor.red.bold('не выполнена'));
                console.log('   ' + $cliColor.red(err.message));
            }
            self._initialized.server = false;
            error = new $swiftErrors.SystemError('Ошибка инициализации сервера.').setInfo(err);
        }

        cb(error);
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
    var self = this,
        errors = [];

    if (typeof cb !== 'function') cb = function(){};

    //
    // проверка возможности запуска приложения
    //
    if (this._isRun.app)
    {
        cb(new $swiftErrors.SystemError('Приложение уже запущено.'));
        return this;
    }
    else if (this._isStartingUp.app)
    {
        cb(new $swiftErrors.SystemError('Приложение уже запускается.'));
        return this;
    }
    else if (self._initialized.app)
    {
        //
        // ожидание завершения инициализации приложения
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (self._initialized.app)
                {
                    awaiting();
                    return;
                }
                //
                // приложение не проинициализировано
                //
                if (!self._isInit.app)
                {
                    cb(new $swiftErrors.SystemError('Приложение не проинициализировано.'));
                    return;
                }
                //
                // запуск приложения
                //
                run();
            });
        })();
    }
    else if (!self._isInit.app)
    {
        cb(new $swiftErrors.SystemError('Приложение не проинициализировано.'));
        return this;
    }
    else run();
    //
    // запуск приложения
    //
    function run ()
    {
        self._isStartingUp.app = true;

        if (!self._disableLog)
        {
            console.log('');
            console.log($cliColor.bold('Запуск приложения'));
        }
        //
        // соединение с БД
        //
        self.dbConnect(function (err)
        {
            if (err)
                if (err instanceof $swiftErrors.MultipleError) errors = errors.concat(err.list);
                else errors.push(err);
            //
            // запуск логгеров
            //
            self.runLoggers(function (err)
            {
                if (err)
                    if (err instanceof $swiftErrors.MultipleError) errors = errors.concat(err.list);
                    else errors.push(err);
                //
                // запуск модулей
                //
                self.runModules(function (err)
                {
                    if (err)
                        if (err instanceof $swiftErrors.MultipleError) errors = errors.concat(err.list);
                        else errors.push(err);
                    //
                    // запуск сервера
                    //
                    self.runServer(function (err)
                    {
                        if (err)
                            if (err instanceof $swiftErrors.MultipleError) errors = errors.concat(err.list);
                            else errors.push(err);

                        if (errors.length)
                        {
                            self._isStartingUp.app = false;
                            cb(new $swiftErrors.MultipleError('Ошибки запуска приложений.').setList(errors));
                            return;
                        }

                        self._isRun.app = true;
                        self._isStartingUp.app = false;
                        cb(null);
                    });
                });
            });
        });
    }

    return this;
};

/**
 * Установление соединений с БД
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.dbConnect = function dbConnect (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        dbAdapters,
        threads = 0,
        errors = [];

    if (typeof cb !== 'function') cb = function(){};

    if (this.dbManager !== null && $swiftUtils.type.isObject(config.swift.dbManager))
    {
        //
        // проверка возможности запуска процесса установления соединений с БД
        //
        if (this._isRun.db)
        {
            cb(new $swiftErrors.SystemError('Соединения с БД уже установлены.'));
            return this;
        }
        else if (this._isStartingUp.db)
        {
            cb(new $swiftErrors.SystemError('Процесс установления соединений с БД уже запущен.'));
            return this;
        }
        else if (self._initialized.db)
        {
            //
            // ожидание завершения инициализации
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (self._initialized.db)
                    {
                        awaiting();
                        return;
                    }
                    //
                    // менеджер баз данных не проинициализировался
                    //
                    if (!self._isInit.db)
                    {
                        cb(new $swiftErrors.SystemError('Менеджер баз данных не проинициализирован.'));
                        return;
                    }
                    //
                    // запуск процесса установления соединений
                    //
                    run();
                });
            })();
        }
        else if (!self._isInit.db)
        {
            cb(new $swiftErrors.SystemError('Менеджер баз данных не проинициализирован.'));
            return this;
        }
        else run();
        //
        // запуск процесса установления соединений
        //
        function run ()
        {
            self._isStartingUp.db = true;
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

                        threads++;

                        (function (connectionName, connectionParams)
                        {
                            //
                            // установление адаптером соединения с БД
                            //
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
                                    threads--;
                                    return;
                                }

                                if (!self._disableLog)
                                    console.log('     соединение "' + $cliColor.blue.bold(connectionName) +
                                        '" (' + connectionParams.uri + '): ' + $cliColor.green.bold('установлено'));
                                threads--;
                            });
                        })(connectionName, connectionParams);
                    }
                }
            }
            //
            // ожидание завершения установления соединений с БД
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (threads)
                    {
                        awaiting();
                        return;
                    }

                    if (errors.length)
                    {
                        self._isStartingUp.db = false;
                        cb(new $swiftErrors.MultipleError('Ошибки установления соединений с БД.').setList(errors));
                        return;
                    }

                    self._isRun.db = true;
                    self._isStartingUp.db = false;
                    cb(null);
                });
            })();
        }
    }
    else cb(null);

    return this;
};

/**
 * Запуск логгеров
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.runLoggers = function runLoggers (cb)
{
    var self = this,
        config = this.configurator.getConfig(),
        loggers,
        threads = 0,
        errors = [];

    if (typeof cb !== 'function') cb = function(){};

    if (this.loggerManager !== null && $swiftUtils.type.isObject(config.swift.loggerManager))
    {
        //
        // проверка возможности запуска логгеров
        //
        if (this._isRun.loggers)
        {
            cb(new $swiftErrors.SystemError('Логгеры уже запущены.'));
            return this;
        }
        else if (this._isStartingUp.loggers)
        {
            cb(new $swiftErrors.SystemError('Логгеры уже запускаются.'));
            return this;
        }
        else if (self._initialized.loggers)
        {
            //
            // ожидание завершения инициализации менеджера логгеров
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (self._initialized.loggers)
                    {
                        awaiting();
                        return;
                    }
                    //
                    // менеджер логгеров не проинициализирован
                    //
                    if (!self._isInit.loggers)
                    {
                        cb(new $swiftErrors.SystemError('Менеджер логгеров не проинициализирован.'));
                        return;
                    }
                    //
                    // запуск логгеров
                    //
                    run();
                });
            })();
        }
        else if (!self._isInit.loggers)
        {
            cb(new $swiftErrors.SystemError('Менеджер логгеров не проинициализирован.'));
            return this;
        }
        else run();
        //
        // запуск логгеров
        //
        function run ()
        {
            self._isStartingUp.loggers = true;
            loggers = self.loggerManager.getAllLoggers();

            if (Object.keys(loggers).length)
            {
                if (!self._disableLog) console.log(' - запуск логгеров:');
                //
                // поочередный запуск логгеров
                //
                for (var loggerName in loggers)
                {if (!loggers.hasOwnProperty(loggerName)) continue;

                    (function (loggerName)
                    {
                        if ($swiftUtils.type.isObject(config.swift.loggerManager.loggers) &&
                            $swiftUtils.type.isObject(config.swift.loggerManager.loggers[loggerName]) &&
                            config.swift.loggerManager.loggers[loggerName].stopped) return;

                        var logger = loggers[loggerName];

                        threads++;
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
                                    console.log('    ' + $cliColor.red(err.message));
                                }
                                errors.push(err);
                                threads--;
                                return;
                            }

                            if (!self._disableLog)
                                console.log('    логгер "' + $cliColor.blue.bold(loggerName) +
                                    '" (' + logger.getPathToLog() + '): ' + $cliColor.green.bold('запущен'));
                            threads--;
                        });
                    })(loggerName);
                }
            }
            //
            // ожидание завершения запуска логгеров
            //
            (function awaiting ()
            {
                immediate(function ()
                {
                    if (threads)
                    {
                        awaiting();
                        return;
                    }

                    if (errors.length)
                    {
                        self._isStartingUp.loggers = false;
                        cb(new $swiftErrors.MultipleError('Ошибки запуска логгеров.').setList(errors));
                        return;
                    }

                    self._isRun.loggers = true;
                    self._isStartingUp.loggers = false;
                    cb(null);
                });
            })();
        }
    }
    else cb(null);

    return this;
};

/**
 * Запуск модулей
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.runModules = function runModules (cb)
{
    var self = this,
        modules,
        threads = 0,
        errors = [];

    if (typeof cb !== 'function') cb = function(){};

    //
    // проверка возможности запуска модулей
    //
    if (this._isRun.modules)
    {
        cb(new $swiftErrors.SystemError('Модули уже запущены.'));
        return this;
    }
    else if (this._isStartingUp.modules)
    {
        cb(new $swiftErrors.SystemError('Модули уже запускаются.'));
        return this;
    }
    else if (self._initialized.modules)
    {
        //
        // ожидание завершения инициализации менеджера модулей
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (self._initialized.modules)
                {
                    awaiting();
                    return;
                }
                //
                // менеджер модулей не проинициализирован
                //
                if (!self._isInit.modules)
                {
                    cb(new $swiftErrors.SystemError('Менеджер модулей не проинициализирован.'));
                    return;
                }
                //
                // запуск модулей
                //
                run();
            });
        })();
    }
    else if (!self._isInit.modules)
    {
        cb(new $swiftErrors.SystemError('Менеджер модулей не проинициализирован.'));
        return this;
    }
    else run();
    //
    // запуск модулей
    //
    function run ()
    {
        self._isStartingUp.modules = true;
        modules = self.moduleManager.getAllModules();

        if (Object.keys(modules).length)
        {
            if (!self._disableLog) console.log(' - запуск модулей:');

            for (var moduleName in modules)
            {if (!modules.hasOwnProperty(moduleName)) continue;

                (function (moduleName)
                {
                    var modul = modules[moduleName];

                    threads++;
                    //
                    // запуск модуля
                    //
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
                            if ($swiftUtils.type.isArray(err)) err.forEach(function (err) { errors.push(err); });
                            else errors.push(err);
                            threads--;
                            return;
                        }

                        if (!self._disableLog)
                            console.log('    модуль "' + $cliColor.blue.bold(moduleName) +
                                '" (' + modul.getPathToModule() + '): ' + $cliColor.green.bold('запущен'));
                        threads--;
                    });
                })(moduleName);
            }
        }
        //
        // ожидание завершения запуска модулей
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (threads)
                {
                    awaiting();
                    return;
                }

                if (errors.length)
                {
                    self._isStartingUp.modules = false;
                    cb(new $swiftErrors.MultipleError('Ошибки запуска модулей.').setList(errors));
                    return;
                }

                self._isRun.modules = true;
                self._isStartingUp.modules = false;
                cb(null);
            });
        })();
    }

    return this;
};

/**
 * Запуск сервера
 *
 * @param {Function} cb
 *
 * @returns {Application}
 */
Application.prototype.runServer = function runServer (cb)
{
    var self = this;

    if (typeof cb !== 'function') cb = function(){};

    //
    // проверка возможности запуска сервера
    //
    if (this._isRun.server)
    {
        cb(new $swiftErrors.SystemError('Сервер уже запущен.'));
        return this;
    }
    else if (this._isStartingUp.server)
    {
        cb(new $swiftErrors.SystemError('Сервер уже запускается.'));
        return this;
    }
    else if (self._initialized.server)
    {
        //
        // ожидание завершения инициализации сервера
        //
        (function awaiting ()
        {
            immediate(function ()
            {
                if (self._initialized.server)
                {
                    awaiting();
                    return;
                }
                //
                // сервер не проинициализирован
                //
                if (!self._isInit.server)
                {
                    cb(new $swiftErrors.SystemError('Сервер не проинициализирован.'));
                    return;
                }
                //
                // запуск сервера
                //
                run();
            });
        })();
    }
    else if (!self._isInit.server)
    {
        cb(new $swiftErrors.SystemError('Сервер не проинициализирован.'));
        return this;
    }
    else run();
    //
    // запуск сервера
    //
    function run ()
    {
        self._isStartingUp.server = true;

        if (!self._disableLog) console.log(' - запуск сервера:');
        //
        // запуск сервера
        //
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
                self._isStartingUp.server = false;
                cb(err);
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

            self._isRun.server = true;
            self._isStartingUp.server = false;
            cb(null);
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