"use client";

import { useState, useEffect } from "react";
import apiClient from "@/libs/api";
import CreateAppModal from "@/components/CreateAppModal";
import AppCard from "@/components/AppCard";
import ButtonAccount from "@/components/ButtonAccount";

export default function Dashboard() {
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchApps = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/apps");
      setApps(res.apps || []);
    } catch (e) {
      console.error(e);
      // Error is already handled by apiClient
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleAppCreated = (newApp) => {
    // Add the new app to the list
    setApps([newApp, ...apps]);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
              Your Apps
            </h1>
            <p className="text-base-content/70">
              Manage your analytics apps and track their performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create New App
            </button>
            <ButtonAccount />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && apps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-24 w-24 mx-auto text-base-content/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">No apps yet</h3>
              <p className="text-base-content/70 mb-6">
                Create your first app to start tracking analytics data from your Swift application.
              </p>
              <button
                className="btn btn-primary btn-lg gap-2"
                onClick={() => setIsModalOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Your First App
              </button>
            </div>
          </div>
        )}

        {/* Apps Grid */}
        {!isLoading && apps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>

      {/* Create App Modal */}
      <CreateAppModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onAppCreated={handleAppCreated}
      />
    </main>
  );
}
