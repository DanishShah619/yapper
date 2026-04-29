// app/search/page.tsx
// A dedicated page for user search.
// Accessible at: http://localhost:3000/search

import { UserSearch } from "@/components/ui/UserSearch"

export const metadata = {
  title: "Find People — NexChat",
  description: "Search for NexChat users by username and send connection requests.",
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#F0F8FF]">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0A0A0A]">
            Find People
          </h1>
          <p className="text-sm font-medium text-[#6B7A99] mt-2">
            Search for other NexChat users by their exact username
            to send a connection request.
          </p>
        </div>

        {/* Search component */}
        <UserSearch />

        {/* Helper note */}
        <div className="mt-6 p-4 bg-white border border-[#D6E8F5]
                        rounded-xl shadow-sm shadow-blue-100/50">
          <p className="text-xs font-semibold text-[#0A0A0A] mb-1">
            💡 How search works
          </p>
          <ul className="text-xs font-medium text-[#6B7A99] space-y-1 list-disc list-inside">
            <li>Search requires an exact username match</li>
            <li>Usernames are case-sensitive</li>
            <li>You can only message users you are connected with</li>
            <li>Partial / fuzzy search is coming in a future update</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
