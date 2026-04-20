'use client';

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: '/api/graphql',
  credentials: 'include', // sends the httpOnly nexchat_token cookie
});

function getCsrfToken(): string {
  if (typeof window === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1] ?? '';
}

const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      'x-csrf-token': getCsrfToken(), // CSRF header — validated server-side
      // No Authorization header — JWT is sent automatically via httpOnly cookie
    },
  };
});

const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

export default client;
