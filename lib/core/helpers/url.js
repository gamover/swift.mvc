/**
 * Created by G@mOBEP
 *
 * Company: Realweb
 * Date: 25.12.12
 * Time: 17:17
 *
 * Помощник ссылок.
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports = module.exports = UrlHelper;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function UrlHelper ()
{
    /**
     * Маршруты (объект вида:
     *     {
     *         'routeAlias1': {
     *             'path': '',
     *             '_path': '',
     *             'module': 'moduleName',
     *             'controller': 'controllerName',
     *             'action': 'actionName'
     *         },
     *         ...
     *         'routeAliasN': {
     *             ...
     *         }
     *     }
     * )
     *
     * @type {Object}
     * @private
     */
    this._routes = {};
}

/**
 * Задание объетка маршрутов
 *
 * @param {Object} routes
 *
 * @returns {UrlHelper}
 */
UrlHelper.prototype.setRoutes = function setRoutes (routes)
{
    this._routes = routes;

    return this;
};

/**
 * Получение объекта маршрутов
 *
 * @returns {Object}
 */
UrlHelper.prototype.getRoutes = function getRoutes ()
{
    return this._routes;
};

/**
 * Восстановление url по псевдониму
 *
 * @param {String} alias псевдоним маршрута
 * @param {Object} params параметры для подстановки
 * @param {Object} routes маршруты
 *
 * @return {String} объект маршрутов
 */
UrlHelper.prototype.resolve = function resolve (alias, params, routes)
{
    params = params || {};
    routes = routes || this._routes;

    var route = routes[alias],
        isRegexp,
        path;

    if (!route) return '';

    isRegexp = !!route._path;
    path = (route._path || route.path).replace('?', '');

    for (var key in params)
    {
        if (!params.hasOwnProperty(key)) continue;

        path = path.replace(':' + key, params[key]);
    }

    if (isRegexp && !path.match(new RegExp(path))) return '';

    return path;
};