// components/ui/UserSearch.tsx
"use client"

// ─────────────────────────────────────────────────────────────────────────────
// UserSearch Component
//
// Displays a search input and shows the result of searching for a user
// by their exact username. Includes connection status and Add Connection button.
//
// Usage:
//   import { UserSearch } from "@/components/ui/UserSearch"
//   <UserSearch />
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import { Search, UserPlus, Check, Clock, User } from "lucide-react"
import { useUserSearch, ConnectionStatus } from "@/lib/hooks/useUserSearch"

// ── Sub-component: Avatar ─────────────────────────────────────────────────────
// Shows the user's avatar image, or a fallback icon if no avatar URL exists

function UserAvatar({ avatarUrl, username }: { avatarUrl: string | null; username: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${username}'s avatar`}
        className="w-10 h-10 rounded-full object-cover border border-[#D6E8F5]"
      />
    )
  }

  // Fallback: show initials in a coloured circle
  return (
    <div className="w-10 h-10 rounded-full bg-[#E1F0FF] border border-[#D6E8F5]
                    flex items-center justify-center">
      <span className="text-sm font-bold text-[#1A3A6B]">
        {username.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

// ── Sub-component: Connection Badge ──────────────────────────────────────────
// Shows a coloured pill indicating the connection status

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="bg-[#D0F5EE] text-[#0A7A65] text-xs font-semibold
                       px-2 py-0.5 rounded-full flex items-center gap-1">
        <Check size={10} />
        Connected
      </span>
    )
  }

  if (status === "pending") {
    return (
      <span className="bg-[#FFF3CD] text-[#7A5900] text-xs font-semibold
                       px-2 py-0.5 rounded-full flex items-center gap-1">
        <Clock size={10} />
        Pending
      </span>
    )
  }

  // "none" and "self" return nothing — no badge shown
  return null
}

// ── Sub-component: Action Button ──────────────────────────────────────────────
// The Add Connection button — hidden for self, disabled for existing connections

function ActionButton({
  status,
  username,
  onSend,
  isLoading,
  justSent,
}: {
  status: ConnectionStatus
  username: string
  onSend: (username: string) => void
  isLoading: boolean
  justSent: boolean
}) {
  // Hide entirely if this is the current user
  if (status === "self") return null

  // Show disabled state for connected users
  if (status === "connected") {
    return (
      <button
        disabled
        className="bg-[#F0F8FF] text-[#6B7A99] text-xs font-semibold
                   px-3 py-1.5 rounded-lg border border-[#D6E8F5] cursor-not-allowed"
      >
        Connected
      </button>
    )
  }

  // Show disabled state for pending requests
  if (status === "pending") {
    return (
      <button
        disabled
        className="bg-[#FFF3CD] text-[#7A5900] text-xs font-semibold
                   px-3 py-1.5 rounded-lg cursor-not-allowed"
      >
        Request Sent
      </button>
    )
  }

  // Show success state momentarily after sending
  if (justSent) {
    return (
      <button
        disabled
        className="bg-[#D0F5EE] text-[#0A7A65] text-xs font-semibold
                   px-3 py-1.5 rounded-lg flex items-center gap-1"
      >
        <Check size={12} />
        Sent!
      </button>
    )
  }

  // Default: Add Connection button
  return (
    <button
      onClick={() => onSend(username)}
      disabled={isLoading}
      className="bg-[#1ABC9C] hover:bg-[#17a589] text-white text-xs font-semibold
                 px-3 py-1.5 rounded-lg transition-all duration-200
                 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <UserPlus size={12} />
      {isLoading ? "Sending..." : "Add Connection"}
    </button>
  )
}

// ── Sub-component: Skeleton Loader ────────────────────────────────────────────
// Shown while the search query is running

function SkeletonResult() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      {/* Avatar skeleton */}
      <div className="w-10 h-10 rounded-full bg-[#D6E8F5] shrink-0" />
      {/* Text skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[#D6E8F5] rounded w-1/3" />
        <div className="h-3 bg-[#E1F0FF] rounded w-1/4" />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function UserSearch() {
  // Track whether a request was just sent (for the "Sent!" button flash)
  const [justSent, setJustSent] = useState(false)

  const {
    inputValue,
    setInputValue,
    foundUser,
    connectionStatus,
    searchLoading,
    searchError,
    showResults,
    handleSendRequest,
    sendLoading,
    sendError,
  } = useUserSearch()

  // Handle sending a connection request
  async function onSendRequest(username: string) {
    const success = await handleSendRequest(username)
    if (success) {
      // Flash "Sent!" for 2 seconds then revert
      setJustSent(true)
      setTimeout(() => setJustSent(false), 2000)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">

      {/* ── Search Input ── */}
      <div className="relative">
        {/* Search icon inside the input */}
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A99]"
        />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search by exact username..."
          aria-label="Search users by username"
          className="w-full bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl
                     pl-9 pr-4 py-2.5 text-sm font-medium text-[#0A0A0A]
                     placeholder:text-[#6B7A99] focus:outline-none
                     focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF]
                     transition-all duration-200"
        />
        {/* Clear button — shows when there is input */}
        {inputValue && (
          <button
            onClick={() => setInputValue("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2
                       text-[#6B7A99] hover:text-[#0A0A0A] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Results Area ── */}
      {/* Only show this section once the user has typed 2+ characters */}
      {showResults && (
        <div className="mt-2 bg-white border border-[#D6E8F5] rounded-xl
                        shadow-sm shadow-blue-100/50 overflow-hidden">

          {/* Loading skeleton */}
          {searchLoading && <SkeletonResult />}

          {/* Error state */}
          {searchError && !searchLoading && (
            <div className="px-4 py-3 text-sm font-medium text-[#8B1A1A]
                            bg-[#FAD7D7] flex items-center gap-2">
              <span>⚠</span>
              <span>Search failed. Check your connection and try again.</span>
            </div>
          )}

          {/* No results found */}
          {!searchLoading && !searchError && !foundUser && (
            <div className="px-4 py-4 text-center">
              <User size={24} className="mx-auto text-[#6B7A99] mb-2" />
              <p className="text-sm font-medium text-[#6B7A99]">
                No user found with that username.
              </p>
              <p className="text-xs font-medium text-[#6B7A99] mt-1">
                Usernames are case-sensitive and must be exact.
              </p>
            </div>
          )}

          {/* Found user result card */}
          {!searchLoading && foundUser && (
            <div
              className="flex items-center gap-3 px-4 py-3
                         hover:bg-[#E1F0FF] transition-all duration-200"
              role="listitem"
              aria-label={`User: ${foundUser.username}`}
            >
              {/* Avatar */}
              <UserAvatar
                avatarUrl={foundUser.avatarUrl}
                username={foundUser.username}
              />

              {/* Username and status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0A0A0A] truncate">
                  {foundUser.username}
                </p>
                <div className="mt-0.5">
                  {/* Show "You" if self-search */}
                  {connectionStatus === "self" ? (
                    <span className="text-xs font-medium text-[#6B7A99]">
                      This is you
                    </span>
                  ) : (
                    <ConnectionBadge status={connectionStatus} />
                  )}
                </div>
              </div>

              {/* Action button */}
              <ActionButton
                status={connectionStatus}
                username={foundUser.username}
                onSend={onSendRequest}
                isLoading={sendLoading}
                justSent={justSent}
              />
            </div>
          )}

          {/* Send error — shown below the result card if mutation failed */}
          {sendError && (
            <div className="px-4 py-2 bg-[#FAD7D7] border-t border-[#D6E8F5]">
              <p className="text-xs font-semibold text-[#8B1A1A]">
                Failed to send request. You may already have a pending request
                with this user.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Minimum length hint — shown before results appear */}
      {inputValue.length === 1 && (
        <p className="mt-2 text-xs font-medium text-[#6B7A99] px-1">
          Type at least 2 characters to search.
        </p>
      )}
    </div>
  )
}
