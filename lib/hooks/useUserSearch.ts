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

import { useState, useEffect, useCallback } from "react"
import { useLazyQuery, useQuery, useMutation} from "@apollo/client/react"
import { gql } from "@apollo/client"
import debounce from "lodash.debounce"

// ── GraphQL Operations ────────────────────────────────────────────────────────

// Search for a user by exact username
// Returns ONE user or null — this is not a fuzzy search
const SEARCH_USER = gql`
  query SearchUser($username: String!) {
    user(username: $username) {
      id
      username
      avatarUrl
    }
  }
`

// Get the current user's profile (used for the self-search guard)
const GET_ME = gql`
  query GetMe {
    me {
      id
      username
    }
  }
`

// Get all accepted connections (used to compute "connected" status)
const GET_CONNECTIONS = gql`
  query GetConnections {
    connections {
      id
      username
    }
  }
`

// connectionRequests returns [Friendship!]! — each has requester and addressee
const GET_CONNECTION_REQUESTS = gql`
  query GetConnectionRequests {
    connectionRequests {
      id
      status
      requester { id username }
      addressee { id username }
    }
  }
`

// sendConnectionRequest returns Friendship!
const SEND_CONNECTION_REQUEST = gql`
  mutation SendConnectionRequest($username: String!) {
    sendConnectionRequest(username: $username) {
      id
      status
      requester { id username }
      addressee { id username }
    }
  }
`

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = "none" | "pending" | "connected" | "self"

export interface SearchedUser {
  id: string
  username: string
  avatarUrl: string | null
}

// ── The Hook ──────────────────────────────────────────────────────────────────

export function useUserSearch() {
  // The raw value of the search input
  const [inputValue, setInputValue] = useState("")

  // ── Queries ────────────────────────────────────────────────────────────────

  // useLazyQuery: does NOT run on mount — only runs when we call searchUser()
  const [searchUser, {
    data: searchData,
    loading: searchLoading,
    error: searchError,
    called: searchCalled  // true once the query has been called at least once
  }] = useLazyQuery<{ user: SearchedUser | null }>(SEARCH_USER, {
    fetchPolicy: "network-only"  // always fetch fresh — don't use cached results
  })

  // These run automatically on mount — we need them to compute connection status
  const { data: meData }           = useQuery<{ me: { id: string; username: string } }>(GET_ME)
  const { data: connectionsData }  = useQuery<{ connections: { id: string; username: string }[] }>(GET_CONNECTIONS)
  const { data: requestsData }     = useQuery<{ connectionRequests: { id: string; status: string; requester: { id: string; username: string }; addressee: { id: string; username: string } }[] }>(GET_CONNECTION_REQUESTS)

  // ── Mutation ───────────────────────────────────────────────────────────────

  const [sendRequest, {
    loading: sendLoading,
    error: sendError
  }] = useMutation(SEND_CONNECTION_REQUEST, {
    // After sending a request, refetch connection requests so the UI updates
    refetchQueries: [{ query: GET_CONNECTION_REQUESTS }]
  })

  // ── Debounce ───────────────────────────────────────────────────────────────

  // useCallback ensures the debounced function is not recreated on every render
  // The empty [] dependency array means it is created once and reused
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      const trimmed = value.trim()
      // Only search if the user has typed at least 2 characters
      // Prevents accidental single-letter searches
      if (trimmed.length >= 2) {
        searchUser({ variables: { username: trimmed } })
      }
    }, 300),
    [] // created once on mount
  )

  // Run the debounced search every time the input changes
  useEffect(() => {
    debouncedSearch(inputValue)

    // Cleanup: cancel any pending debounce when the component unmounts
    // or when inputValue changes before the 300ms fires
    return () => debouncedSearch.cancel()
  }, [inputValue, debouncedSearch])

  // ── Connection Status Computation ─────────────────────────────────────────

  // Given a userId, returns one of: "self" | "connected" | "pending" | "none"
  // This is computed from the data we already have — no extra API call needed
  function getConnectionStatus(userId: string): ConnectionStatus {
    // Self-search guard: if the found user is the current user, return "self"
    if (meData?.me?.id === userId) return "self"

    // Check if already connected (accepted friendship)
    const isConnected = connectionsData?.connections?.some(
      (c: { id: string }) => c.id === userId
    )
    if (isConnected) return "connected"

    // Check if a request is already pending (incoming or outgoing)
    // connectionRequests returns Friendship objects where requester or addressee matches
    const isPending = requestsData?.connectionRequests?.some(
      (r) => r.requester.id === userId || r.addressee.id === userId
    )
    if (isPending) return "pending"

    return "none"
  }

  // ── Send Connection Request ────────────────────────────────────────────────

  async function handleSendRequest(username: string): Promise<boolean> {
    try {
      await sendRequest({ variables: { username } })
      return true  // success
    } catch {
      return false // failure — the error is available via sendError
    }
  }

  // ── Derived Values ────────────────────────────────────────────────────────

  // The found user (or null if not found / not searched yet)
  const foundUser: SearchedUser | null = searchData?.user ?? null

  // Connection status of the found user (only relevant if foundUser is not null)
  const connectionStatus: ConnectionStatus = foundUser
    ? getConnectionStatus(foundUser.id)
    : "none"

  // Should we show the search results area at all?
  // Yes if: the query has been called AND the input has content
  const showResults = searchCalled && inputValue.trim().length >= 2

  // ── Return Everything the Component Needs ─────────────────────────────────

  return {
    inputValue,        // current value of the search input
    setInputValue,     // call this when the input changes
    foundUser,         // the found user object, or null
    connectionStatus,  // "none" | "pending" | "connected" | "self"
    searchLoading,     // true while the search query is running
    searchError,       // ApolloError if the search query failed
    showResults,       // whether to show the results area
    handleSendRequest, // call this with a username to send a connection request
    sendLoading,       // true while the mutation is running
    sendError,         // ApolloError if the mutation failed
  }
}
