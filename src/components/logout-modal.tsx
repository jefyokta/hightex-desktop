import { useState } from "react";
import { useLogoutModal } from "../context/logout-modal-context";
import { Modal } from "./modal";

export const LogoutModal = () => {
  const { logoutOpen, closeLogout } = useLogoutModal();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await window.session.logout();
      closeLogout();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={logoutOpen} onClose={closeLogout}>
      <div className="w-90 p-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Logout from HighTex?
          </h2>
          <p className="text-sm text-gray-500">
            You will be signed out of your current session.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={closeLogout}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
