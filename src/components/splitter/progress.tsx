import { Check, Circle, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type Job = {
  name: string;
  task: (...args: any) => Promise<any>;
};

type Status = "pending" | "running" | "success" | "error";

interface ProgressJobProps {
  jobs: Job[];
  started: boolean;
  onSuccess?: (res: any) => void;
  onError?: (jobIndex: number, error: unknown) => void;
  onProgress?: (progres: string) => void;
}



export const ProgressJob = ({
  jobs,
  started,
  onSuccess,
  onError,
  onProgress
}: ProgressJobProps) => {
  const [status, setStatus] = useState<Status[]>(jobs.map(() => "pending"));


  useEffect(() => {
    setStatus(jobs.map(() => "pending"));
  }, [jobs]);

  const [progress, setProgress] = useState<string>();

  useEffect(()=>{
    if(!progress) return
    onProgress?.(progress)
  },[progress])

  useEffect(() => {
    if (!started) return;

    let cancelled = false;

    const run = async () => {
      const next = jobs.map(() => "pending" as Status);
      setStatus([...next]);
      let res: any;

      for (let i = 0; i < jobs.length; i++) {
        if (cancelled) return;

        next[i] = "running";
        setStatus([...next]);

        try {
          res = await jobs[i].task(res, setProgress);

          if (cancelled) return;

          next[i] = "success";
          setStatus([...next]);
        } catch (error) {
          if (cancelled) return;

          next[i] = "error";
          setStatus([...next]);

          onError?.(i, error);
          return;
        }
      }

      onSuccess?.(res);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [started]);

  return (
    <div className="w-full">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${jobs.length}, minmax(0, 1fr))`,
        }}
      >
        {jobs.map((job, index) => {
          const current = status[index];

          const connectorFilled =
            current === "success" ||
            status[index + 1] === "running" ||
            status[index + 1] === "success" ||
            status[index + 1] === "error";

          return (
            <div
              key={job.name}
              className="relative flex flex-col items-center"
            >
              {index < jobs.length - 1 && (
                <div className="absolute top-3.5 left-[calc(50%+20px)] right-[calc(-50%+20px)]">
                  <div className="relative h-0.75 overflow-hidden rounded-full bg-border">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{
                        width: connectorFilled ? "100%" : "0%",
                      }}
                      transition={{
                        duration: 0.35,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                </div>
              )}

              <motion.div
                layout
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 24,
                }}
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background shadow-sm",
                  {
                    "border-muted text-muted-foreground":
                      current === "pending",

                    "border-primary bg-primary text-primary-foreground":
                      current === "running",

                    "border-green-500 bg-green-500 text-white":
                      current === "success",

                    "border-destructive bg-destructive text-destructive-foreground":
                      current === "error",
                  }
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current}
                    initial={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    transition={{
                      duration: 0.18,
                    }}
                  >
                    {current === "success" ? (
                      <Check className="h-4 w-4" />
                    ) : current === "error" ? (
                      <X className="h-4 w-4" />
                    ) : current === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Circle className="h-3 w-3 fill-current" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <motion.span
                layout
                className={cn(
                  "mt-3 max-w-28 text-center text-xs font-medium leading-tight",
                  {
                    "text-muted-foreground":
                      current === "pending",

                    "text-primary":
                      current === "running",

                    "text-green-600 dark:text-green-400":
                      current === "success",

                    "text-destructive":
                      current === "error",
                  }
                )}
              >
                {job.name}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
