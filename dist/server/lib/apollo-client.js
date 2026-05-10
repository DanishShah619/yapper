"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@apollo/client");
const context_1 = require("@apollo/client/link/context");
const httpLink = (0, client_1.createHttpLink)({
    uri: '/api/graphql',
    credentials: 'include', // sends the httpOnly nexchat_token cookie
});
function getCsrfToken() {
    var _a, _b;
    if (typeof window === 'undefined')
        return '';
    return (_b = (_a = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))) === null || _a === void 0 ? void 0 : _a.split('=')[1]) !== null && _b !== void 0 ? _b : '';
}
const authLink = (0, context_1.setContext)((_, { headers }) => {
    return {
        headers: Object.assign(Object.assign({}, headers), { 'x-csrf-token': getCsrfToken() }),
    };
});
const client = new client_1.ApolloClient({
    link: client_1.ApolloLink.from([authLink, httpLink]),
    cache: new client_1.InMemoryCache(),
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'cache-and-network',
        },
    },
});
exports.default = client;
