/**
 * Created by G@mOBEP
 *
 * Company: Realweb
 * Date: 13.02.13
 * Time: 12:12
 */

var $swiftUtils = require('swift.utils'),

    ConfiguratorError = require('./errors/configuratorError').ConfiguratorError;

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
 * @param {Object} config
 *
 * @returns {Configurator}
 */
Configurator.prototype.compile = function (config)
{
    if (!$swiftUtils.type.isObject(config)) throw new ConfiguratorError()
        .setMessage('Не удалось скомпилировать конфигурацию. Конфигурация не передана или представлена в недопустимом формате')
        .setCode(ConfiguratorError.codes.BAD_CONFIG);

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
    if (!$swiftUtils.type.isObject(configSrc)) throw new ConfiguratorError()
        .setMessage('Не удалось произвести наследования настроек в конфигурации. Конфигурация не передана или представлена в недопустимом формате')
        .setCode(ConfiguratorError.codes.BAD_CONFIG);

    var nsPart = configSrc[this._env] || configSrc['development'] || configSrc['production'] || {},
        config = {};

    while (nsPart)
    {
        (function extendConfig (config, nsPart)
        {
            for (var key in nsPart)
            {
                if (!nsPart.hasOwnProperty(key)) continue;

                if (typeof nsPart[key] !== 'object' || (nsPart[key] instanceof Array))
                {
                    config[key] = config[key] || nsPart[key];
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
    if (!$swiftUtils.type.isObject(supConfig)) throw new ConfiguratorError()
        .setMessage('Не удалось дополнить конфигурацию. Конфигурация не передана или представлена в недопустимом формате')
        .setCode(ConfiguratorError.codes.BAD_CONFIG);

    (function complete (config, supConfig)
    {
        for (var key in supConfig)
        {
            if (!supConfig.hasOwnProperty(key)) continue;

            if (typeof supConfig[key] !== 'object' || (supConfig[key] instanceof Array))
            {
                config[key] = config[key] || supConfig[key];
            }
            else
            {
                config[key] = config[key] || {};

                if (typeof config[key] === 'object' && !(config[key] instanceof Array))
                {
                    complete(config[key], supConfig[key]);
                }
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