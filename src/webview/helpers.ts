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
}
