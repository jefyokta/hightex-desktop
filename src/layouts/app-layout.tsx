import { Outlet } from "react-router";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/navbar";
import { isMac } from "@/utils/is-mac";
import { useEffect, useState } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { EventBus } from "@/event/event-bus";

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

    return EventBus.on("document:updated", async () => {
      await fillRecent();
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar recent={recent} />
        <div className={`flex-1 overflow-hidden pb-5 pr-5 ${!isMac && "pt-5"}`}>
          <div className="h-full flex bg-white  border-l rounded-2xl py-5 border-gray-100 text-gray-900">
            <div className="w-full h-full flex flex-col p-1  overflow-hidden">
              {/* <Header /> */}
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
