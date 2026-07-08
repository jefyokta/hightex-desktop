import { useEffect, useState } from "react";
import { TabHeader } from "./components/tab-header";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Document } from "@/editor/document";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { isStaticVar } from "@/utils/is-static-var";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { Manager } from "@/editor/manager";

export const VariableTab = () => {
  const [vars, setVars] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newLine, setNewLine] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const db = HighTexDB.getInstance();

  const load = async () => {
    if (!Document.instance) return;

    setLoading(true);
    const data = await db.getVarsOnlyOn(Document.instance.id);
    setVars(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const parseLine = (line: string) => {
    const idx = line.indexOf("=");
    if (idx === -1) return null;

    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (!name) return null;

    return { name, value };
  };

  const saveCreate = async () => {
    const parsed = parseLine(newLine);
    if (!parsed) return;

    if (isStaticVar(parsed.name))
      throw new ShouldNotified({
        message: `Cannot create variable`,
        description: `\`${parsed.name}\` is static variable`,
      });

    await db.setVar(parsed.name, parsed.value, Document.instance!.id);
    Manager.app.dispatch("var:updated", parsed)


    setNewLine("");
    setCreating(false);
    await load();
  };

  const saveEdit = async (name: string) => {
    if (isStaticVar(name))
      throw new ShouldNotified(
        "Variable name cannot be same as static variable Name",
      );

    await db.setVar(name, draft, Document.instance!.id);
    Manager.app.dispatch("var:updated", { name, value: draft })

    setEditing(null);
    await load();
  };

  const remove = async (name: string) => {
    if (isStaticVar(name))
      throw new ShouldNotified("Cannot Delete static vars");

    await db.deleteVar(name, Document.instance!.id);
    Manager.app.dispatch("var:updated", { name, value: "" })

    await load();
  };

  const sortedVars = [...vars].sort((a, b) => {
    const aStatic = isStaticVar(a.name);
    const bStatic = isStaticVar(b.name);

    if (aStatic && !bStatic) return -1;
    if (!aStatic && bStatic) return 1;

    return a.name.localeCompare(b.name);
  });

  return (
    <TooltipProvider>
      <div className="w-full h-full overflow-auto">
        <TabHeader title="Variables" desc="Document variables" />

        <div className="px-2 py-2">
          {creating ? (
            <div className="flex items-center gap-2 border rounded-md px-2 py-1">
              <input
                autoFocus
                value={newLine}
                onChange={(e) => setNewLine(e.target.value.trim())}
                placeholder="key = value"
                className="flex-1 bg-transparent outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewLine("");
                  }
                }}
              />

              <button onClick={saveCreate} className="text-xs">
                save
              </button>
            </div>
          ) : (
            <Button
              onClick={() => setCreating(true)}
              className="cursor-pointer"
            >
              add variable
            </Button>
          )}
        </div>

        <div className="px-2 space-y-2 text-sm">
          {loading ? (
            <div className="text-neutral-500 text-xs py-3">loading...</div>
          ) : sortedVars.length === 0 ? (
            <div className="text-neutral-500 text-xs py-3">no variables</div>
          ) : (
            sortedVars.map((v) => {
              const locked = isStaticVar(v.name);
              const isEditing = editing === v.name;

              return (
                <div
                  key={v.name}
                  className={[
                    "border rounded-md px-3 py-2",
                    "bg-white dark:bg-neutral-900",
                    "hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    locked ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate cursor-default">
                            {v.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{v.name}</TooltipContent>
                      </Tooltip>

                      <span className="text-neutral-400">=</span>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-neutral-600 dark:text-neutral-300"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(v.name);
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-neutral-500 truncate cursor-default">
                              {v.value}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{v.value}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* ACTIONS */}
                    {!locked && (
                      <div className="flex items-center gap-2 text-xs">
                        {isEditing ? (
                          <button onClick={() => saveEdit(v.name)}>save</button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditing(v.name);
                                setDraft(v.value);
                              }}
                            >
                              edit
                            </button>

                            <button
                              onClick={() => remove(v.name)}
                              className="text-red-500"
                            >
                              delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
