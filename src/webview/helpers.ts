import * as Handlebars from 'handlebars';

export function registerCustomHelpers() {
    Handlebars.registerHelper('uppercase', function (str) {
        return typeof str === 'string' ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', function (str) {
        return typeof str === 'string' ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('capitalize', function (str) {
        if (typeof str !== 'string' || !str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('default', function (value, defaultValue) {
        return value !== undefined && value !== null ? value : defaultValue;
    });

    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });

    Handlebars.registerHelper('neq', function (a, b) {
        return a !== b;
    });

    Handlebars.registerHelper('lt', function (a, b) {
        return a < b;
    });

    Handlebars.registerHelper('lte', function (a, b) {
        return a <= b;
    });

    Handlebars.registerHelper('gt', function (a, b) {
        return a > b;
    });

    Handlebars.registerHelper('gte', function (a, b) {
        return a >= b;
    });

    Handlebars.registerHelper('and', function () {
        return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
    });

    Handlebars.registerHelper('or', function () {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    });
}
