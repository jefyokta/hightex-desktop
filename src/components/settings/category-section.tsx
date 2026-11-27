import { useIPC } from "@/hooks/use-ipc";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/utils/lang";

export function CategorySection() {
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<"success" | "failed" | null>(null);
  const refresh = async () => {
    if (updating) return;
    setUpdating(true);
    setResult(null);
    try {
      await useIPC("hightex").hightex.refreshCategories();
      setResult("success");
    } catch {
      setResult("failed");
    } finally {
      setUpdating(false);
    }
  };
  return (
    <Card data-tour="category-settings">
      <CardHeader>
        <CardTitle>{t("settings.categories.title")}</CardTitle>
        <CardDescription>
          {t("settings.categories.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={updating}
          aria-busy={updating}
        >
          <RefreshCw className={updating ? "animate-spin" : ""} />
          {t(
            updating
              ? "settings.categories.updating"
              : "settings.categories.update",
          )}
        </Button>
        {result && (
          <p
            role={result === "failed" ? "alert" : "status"}
            className="text-sm text-muted-foreground"
          >
            {t(
              result === "failed"
                ? "settings.categories.failed"
                : "settings.categories.success",
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
