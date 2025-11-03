"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

// Card component to display an app with its details
const AppCard = ({ app }) => {
  const [showAppId, setShowAppId] = useState(false);

  const copyAppId = () => {
    navigator.clipboard.writeText(app.app_id);
    toast.success("App ID copied to clipboard!");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow duration-200">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="card-title text-xl mb-2">{app.name}</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-base-content/70 mb-1">App ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-base-200 px-3 py-2 rounded-lg font-mono flex-1">
                    {showAppId ? app.app_id : "•••••••••••••••••"}
                  </code>
                  <button
                    className="btn btn-sm btn-square btn-ghost"
                    onClick={() => setShowAppId(!showAppId)}
                    title={showAppId ? "Hide App ID" : "Show App ID"}
                  >
                    {showAppId ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    className="btn btn-sm btn-square btn-primary"
                    onClick={copyAppId}
                    title="Copy App ID"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-4 text-sm text-base-content/60">
                <div>
                  <span className="font-semibold">Created:</span>{" "}
                  {formatDate(app.created_at)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-actions justify-end mt-4">
          <div className="badge badge-outline badge-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Active
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppCard;
