import { Outlet } from "react-router";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/navbar";
import { isMac } from "@/utils/is-mac";
import { useEffect, useState } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";

export const AppLayout = () => {
  const [recent, setRecent] = useState<HighTexDocument[]>([]);

  useEffect(() => {
    const fillRecent = async () => {
      const docs = await HighTexDB.getInstance()
        .documents.filter((doc) => doc.updatedAt !== undefined)
        .limit(5)
        .toArray();

      setRecent(
        docs.sort(
          (a, b) =>
            new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime(),
        ),
      );
    };

    fillRecent();

    return Manager.app.on("document:updated", async () => {
      await fillRecent();
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
      <Navbar />

      <div className="flex flex-1 min-h-0">
        <Sidebar recent={recent} />

        <div
          className={`flex-1 overflow-hidden pb-5 pr-5 ${!isMac ? "pt-5" : ""}`}
        >
          <div className="h-full flex bg-white dark:bg-neutral-950  rounded-2xl py-5 text-neutral-900 dark:text-neutral-100 transition-colors">
            <div className="w-full h-full flex flex-col p-1 overflow-hidden">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
