"use client";

import { useState, useEffect } from "react";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";

const USER_SEARCH_QUERY = gql`
  query User($username: String!) {
    user(username: $username) {
      id
      email
      username
      avatarUrl
    }
  }
`;

const SEND_CONNECTION_REQUEST = gql`
  mutation SendConnectionRequest($username: String!) {
    sendConnectionRequest(username: $username) {
      id
      status
      requester { id username }
      addressee { id username }
      createdAt
    }
  }
`;

export default function ConnectionsPage() {
  const [search, setSearch] = useState("");
  type UserType = { id: string; email: string; username: string; avatarUrl?: string };
  const [user, setUser] = useState<UserType | null>(null);
  const [message, setMessage] = useState("");

  const [fetchUser, { loading: searchLoading, data: searchData, error: searchError }] = useLazyQuery(USER_SEARCH_QUERY);

  // Handle search results and errors
  useEffect(() => {
    if (searchData && (searchData as any).user) setUser((searchData as any).user);
    if (searchError) setMessage(searchError.message);
  }, [searchData, searchError]);

  const [sendRequest, { loading: requestLoading }] = useMutation(SEND_CONNECTION_REQUEST, {
    onCompleted: () => setMessage("Connection request sent!"),
    onError: (err: { message: string }) => setMessage(err.message),
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    fetchUser({ variables: { username: search } });
  };

  const handleSendRequest = () => {
    if (user) {
      sendRequest({ variables: { username: user.username } });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Find and Connect</h2>
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Enter username or email"
          className="border p-2 rounded w-full"
        />
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          disabled={searchLoading}
        >
          Search
        </button>
      </form>
      {user && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{user.username}</span>
            {user.avatarUrl && (
              <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
            )}
          </div>
          <button
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
            onClick={handleSendRequest}
            disabled={requestLoading}
          >
            Send Connection Request
          </button>
        </div>
      )}
      {message && <div className="text-red-600 mt-2">{message}</div>}
    </div>
  );
}
