/**
 * Created by G@mOBEP
 *
 * Company: Realweb
 * Date: 28.01.13
 * Time: 12:17
 *
 * Набор помощников Swift.
 */

var UrlHelper = require('./helpers/url');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.HelperManager = HelperManager;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function HelperManager ()
{
    /**
     * Список помощников
     *
     * @type {Object}
     * @private
     */
    this._helpers = {
        url: new UrlHelper()
    };
}

/**
 * Добавление хелпера
 *
 * @param {String} helperName название хелпера
 * @param {Object} helper объект хелпера
 *
 * @returns {HelperManager}
 */
HelperManager.prototype.addHelper = function addHelper (helperName, helper)
{
    if (!this._helpers[helperName]) this._helpers[helperName] = helper;

    return this;
};

/**
 * Получение хелпера
 *
 * @param {String} helperName название хелпера
 *
 * @returns {Object}
 */
HelperManager.prototype.get = function get (helperName)
{
    return (helperName ? this._helpers[helperName] : this._helpers);
};

/**
 * Инициализация хелперов
 *
 * @param {Object} params параметры
 *
 * @returns {HelperManager}
 */
HelperManager.prototype.init = function init (params)
{
    this._helpers.url.setRoutes(params.routes);

    return this;
};