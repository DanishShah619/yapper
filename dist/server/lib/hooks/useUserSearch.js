"use strict";
// lib/hooks/useUserSearch.ts
// ─────────────────────────────────────────────────────────────────────────────
// This hook handles:
// 1. Storing the search input value
// 2. Debouncing the search (waits 300ms after typing stops)
// 3. Running the GraphQL query for a single user by username
// 4. Running the connections and pending requests queries
// 5. Computing the connection status for the found user
// 6. Exposing the sendConnectionRequest mutation
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useUserSearch = useUserSearch;
const react_1 = require("react");
const react_2 = require("@apollo/client/react");
const client_1 = require("@apollo/client");
const lodash_debounce_1 = __importDefault(require("lodash.debounce"));
// ── GraphQL Operations ────────────────────────────────────────────────────────
// Search for a user by exact username
// Returns ONE user or null — this is not a fuzzy search
const SEARCH_USER = (0, client_1.gql) `
  query SearchUser($username: String!) {
    user(username: $username) {
      id
      username
      avatarUrl
    }
  }
`;
// Get the current user's profile (used for the self-search guard)
const GET_ME = (0, client_1.gql) `
  query GetMe {
    me {
      id
      username
    }
  }
`;
// Get all accepted connections (used to compute "connected" status)
const GET_CONNECTIONS = (0, client_1.gql) `
  query GetConnections {
    connections {
      id
      username
    }
  }
`;
// connectionRequests returns [Friendship!]! — each has requester and addressee
const GET_CONNECTION_REQUESTS = (0, client_1.gql) `
  query GetConnectionRequests {
    connectionRequests {
      id
      status
      requester { id username }
      addressee { id username }
    }
  }
`;
// sendConnectionRequest returns Friendship!
const SEND_CONNECTION_REQUEST = (0, client_1.gql) `
  mutation SendConnectionRequest($username: String!) {
    sendConnectionRequest(username: $username) {
      id
      status
      requester { id username }
      addressee { id username }
    }
  }
`;
// ── The Hook ──────────────────────────────────────────────────────────────────
function useUserSearch() {
    var _a;
    // The raw value of the search input
    const [inputValue, setInputValue] = (0, react_1.useState)("");
    // ── Queries ────────────────────────────────────────────────────────────────
    // useLazyQuery: does NOT run on mount — only runs when we call searchUser()
    const [searchUser, { data: searchData, loading: searchLoading, error: searchError, called: searchCalled // true once the query has been called at least once
     }] = (0, react_2.useLazyQuery)(SEARCH_USER, {
        fetchPolicy: "network-only" // always fetch fresh — don't use cached results
    });
    // These run automatically on mount — we need them to compute connection status
    const { data: meData } = (0, react_2.useQuery)(GET_ME);
    const { data: connectionsData } = (0, react_2.useQuery)(GET_CONNECTIONS);
    const { data: requestsData } = (0, react_2.useQuery)(GET_CONNECTION_REQUESTS);
    // ── Mutation ───────────────────────────────────────────────────────────────
    const [sendRequest, { loading: sendLoading, error: sendError }] = (0, react_2.useMutation)(SEND_CONNECTION_REQUEST, {
        // After sending a request, refetch connection requests so the UI updates
        refetchQueries: [{ query: GET_CONNECTION_REQUESTS }]
    });
    // ── Debounce ───────────────────────────────────────────────────────────────
    // useCallback ensures the debounced function is not recreated on every render
    // The empty [] dependency array means it is created once and reused
    const debouncedSearch = (0, react_1.useCallback)((0, lodash_debounce_1.default)((value) => {
        const trimmed = value.trim();
        // Only search if the user has typed at least 2 characters
        // Prevents accidental single-letter searches
        if (trimmed.length >= 2) {
            searchUser({ variables: { username: trimmed } });
        }
    }, 300), [] // created once on mount
    );
    // Run the debounced search every time the input changes
    (0, react_1.useEffect)(() => {
        debouncedSearch(inputValue);
        // Cleanup: cancel any pending debounce when the component unmounts
        // or when inputValue changes before the 300ms fires
        return () => debouncedSearch.cancel();
    }, [inputValue, debouncedSearch]);
    // ── Connection Status Computation ─────────────────────────────────────────
    // Given a userId, returns one of: "self" | "connected" | "pending" | "none"
    // This is computed from the data we already have — no extra API call needed
    function getConnectionStatus(userId) {
        var _a, _b, _c;
        // Self-search guard: if the found user is the current user, return "self"
        if (((_a = meData === null || meData === void 0 ? void 0 : meData.me) === null || _a === void 0 ? void 0 : _a.id) === userId)
            return "self";
        // Check if already connected (accepted friendship)
        const isConnected = (_b = connectionsData === null || connectionsData === void 0 ? void 0 : connectionsData.connections) === null || _b === void 0 ? void 0 : _b.some((c) => c.id === userId);
        if (isConnected)
            return "connected";
        // Check if a request is already pending (incoming or outgoing)
        // connectionRequests returns Friendship objects where requester or addressee matches
        const isPending = (_c = requestsData === null || requestsData === void 0 ? void 0 : requestsData.connectionRequests) === null || _c === void 0 ? void 0 : _c.some((r) => r.requester.id === userId || r.addressee.id === userId);
        if (isPending)
            return "pending";
        return "none";
    }
    // ── Send Connection Request ────────────────────────────────────────────────
    async function handleSendRequest(username) {
        try {
            await sendRequest({ variables: { username } });
            return true; // success
        }
        catch (_a) {
            return false; // failure — the error is available via sendError
        }
    }
    // ── Derived Values ────────────────────────────────────────────────────────
    // The found user (or null if not found / not searched yet)
    const foundUser = (_a = searchData === null || searchData === void 0 ? void 0 : searchData.user) !== null && _a !== void 0 ? _a : null;
    // Connection status of the found user (only relevant if foundUser is not null)
    const connectionStatus = foundUser
        ? getConnectionStatus(foundUser.id)
        : "none";
    // Should we show the search results area at all?
    // Yes if: the query has been called AND the input has content
    const showResults = searchCalled && inputValue.trim().length >= 2;
    // ── Return Everything the Component Needs ─────────────────────────────────
    return {
        inputValue, // current value of the search input
        setInputValue, // call this when the input changes
        foundUser, // the found user object, or null
        connectionStatus, // "none" | "pending" | "connected" | "self"
        searchLoading, // true while the search query is running
        searchError, // ApolloError if the search query failed
        showResults, // whether to show the results area
        handleSendRequest, // call this with a username to send a connection request
        sendLoading, // true while the mutation is running
        sendError, // ApolloError if the mutation failed
    };
}
