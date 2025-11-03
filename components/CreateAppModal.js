"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import apiClient from "@/libs/api";
import { toast } from "react-hot-toast";

// Modal component for creating a new app
// Shows a form to enter app name and generates a unique app_id
const CreateAppModal = ({ isModalOpen, setIsModalOpen, onAppCreated }) => {
  const [appName, setAppName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdApp, setCreatedApp] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!appName.trim()) {
      toast.error("Please enter an app name");
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.post("/apps/create", {
        name: appName.trim(),
      });

      setCreatedApp(res.app);
      toast.success("App created successfully!");

      // Call the callback to refresh the apps list
      if (onAppCreated) {
        onAppCreated(res.app);
      }
    } catch (e) {
      console.error(e);
      // Error is already handled by apiClient
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    // Reset form after a short delay for smooth transition
    setTimeout(() => {
      setAppName("");
      setCreatedApp(null);
    }, 300);
  };

  return (
    <Transition appear show={isModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={handleClose}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-focus bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full overflow-hidden items-start md:items-center justify-center p-2">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-lg transform text-left align-middle shadow-xl transition-all rounded-xl bg-base-100 p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <Dialog.Title as="h2" className="text-2xl font-bold">
                    {createdApp ? "App Created!" : "Create New App"}
                  </Dialog.Title>
                  <button
                    className="btn btn-square btn-ghost btn-sm"
                    onClick={handleClose}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>

                {!createdApp ? (
                  <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                      <label htmlFor="appName" className="label">
                        <span className="label-text font-semibold">App Name</span>
                      </label>
                      <input
                        type="text"
                        id="appName"
                        className="input input-bordered w-full"
                        placeholder="My Analytics App"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        disabled={isLoading}
                        autoFocus
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/70">
                          Enter a name for your app. A unique App ID will be generated.
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleClose}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !appName.trim()}
                      >
                        {isLoading ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Creating...
                          </>
                        ) : (
                          "Create App"
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="alert alert-success">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Your app has been created successfully!</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">App Name</span>
                        </label>
                        <div className="p-3 bg-base-200 rounded-lg">
                          <p className="font-medium">{createdApp.name}</p>
                        </div>
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">App ID</span>
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 p-3 bg-base-200 rounded-lg font-mono text-sm">
                            {createdApp.app_id}
                          </div>
                          <button
                            className="btn btn-square btn-outline"
                            onClick={() => {
                              navigator.clipboard.writeText(createdApp.app_id);
                              toast.success("App ID copied to clipboard!");
                            }}
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
                        <label className="label">
                          <span className="label-text-alt text-base-content/70">
                            Use this App ID in your Swift SDK to send analytics data.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        className="btn btn-primary"
                        onClick={handleClose}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateAppModal;
