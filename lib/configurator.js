/**
 * Created by G@mOBEP
 *
 * Company: Realweb
 * Date: 13.02.13
 * Time: 12:12
 */

var $swiftErrors = require('swift.errors'),
    $swiftUtils = require('swift.utils');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Configurator ()
{
    /**
     * Переменная окружения
     *
     * @type {String}
     * @private
     */
    this._env = process.env.NODE_ENV || 'development';

    /**
     * Объект конфигурации
     *
     * @type {Object}
     * @private
     */
    this._config = {};
}

/**
 * Компиляция конфигурации
 *
 * @param {Object} config объект конфигурации
 *
 * @returns {Configurator}
 */
Configurator.prototype.compile = function (config)
{
    //
    // проверка параметров
    //
    if (!$swiftUtils.type.isObject(config))
        throw new $swiftErrors.TypeError('Недопустимый тип конфигурации (ожидается: "object", принято: "' + typeof config + '").');
    //
    // наследование namespace и задание конфигурации
    //
    this._config = this.extend(config);

    return this;
};

/**
 * Наследование namespace конфигурации
 *
 * @param {Object} configSrc исходная конфигурация
 *
 * @returns {Object}
 */
Configurator.prototype.extend = function (configSrc)
{
    var nsPart,
        config = {};

    //
    // проверка параметров
    //
    if (!$swiftUtils.type.isObject(configSrc))
        throw new $swiftErrors.TypeError('Недопустимый тип конфигурации (ожидается: "object", принято: "' + typeof configSrc + '").');
    //
    // получение части конфигурации для текущего неймспейса
    //
    nsPart = configSrc[this._env] || configSrc['development'] || configSrc['production'] || {};
    //
    // выполнение наследования
    //
    while (nsPart)
    {
        (function extendConfig (config, nsPart)
        {
            for (var key in nsPart)
            {
                if (!nsPart.hasOwnProperty(key)) continue;

                if (typeof nsPart[key] !== 'object' || (nsPart[key] instanceof Array))
                {
                    config[key] = (typeof config[key] !== 'undefined' ? config[key] : nsPart[key]);
                }
                else
                {
                    config[key] = config[key] || {};

                    if (typeof config[key] === 'object' && !(config[key] instanceof Array))
                    {
                        extendConfig(config[key], nsPart[key]);
                    }
                }
            }
        })(config, nsPart);

        nsPart = configSrc[nsPart.$extends];
    }

    delete config.$extends;

    return config;
};

/**
 * Дополнение конфигурации
 *
 * @param {Object} supConfig дополняющая конфигурация
 *
 * @returns {Configurator}
 */
Configurator.prototype.complete = function (supConfig)
{
    //
    // проверка параметров
    //
    if (!$swiftUtils.type.isObject(supConfig))
        throw new $swiftErrors.TypeError('Недопустимый тип конфигурации (ожидается: "object", принято: "' + typeof supConfig + '").');
    //
    // выполнение дополнения конфигурации
    //
    (function complete (config, supConfig)
    {
        for (var key in supConfig)
        {
            if (!supConfig.hasOwnProperty(key)) continue;

            if (!$swiftUtils.type.isObject(supConfig[key])) config[key] = config[key] || supConfig[key];
            else
            {
                config[key] = config[key] || {};

                if ($swiftUtils.type.isObject(supConfig[key])) complete(config[key], supConfig[key]);
            }
        }
    })(this._config, supConfig);

    return this;
};

/**
 * Получение конфигурации
 *
 * @returns {Object}
 */
Configurator.prototype.getConfig = function ()
{
    return this._config;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Configurator = Configurator;