import { useConfig } from "@/hooks/use-config";
import { t } from "@/utils/lang";

import { Modal } from "../modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { EditorSettingsFields } from "@/components/settings/editor-settings-fields";
import { Manager } from "@/editor/manager";
import { useCurrentEditor } from "@/hooks/use-editor";
import { PaginationFeedback } from "./pagination-feedback";

type SettingModalProps = {
  open?: boolean;
  onClose?: () => void;
};

export const SettingModal: React.FC<SettingModalProps> = ({
  open = false,
  onClose = () => {},
}) => {
  const { config, saveConfig } = useConfig();
  const { editor } = useCurrentEditor();

  const saveEditor = async (
    patch: Partial<ConfigShape["editor"]>,
  ): Promise<void> => {
    await saveConfig({ editor: patch });
    if (patch.aliasHint !== undefined) Manager.app.dispatch("chapter:reload", {});
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Card className="m-2">
        <CardHeader>
          <CardTitle>{t("settings.editor.title")}</CardTitle>
          <CardDescription>{t("settings.editor.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <EditorSettingsFields
            value={config?.editor}
            onChange={saveEditor}
            paginationFeedback={<PaginationFeedback editor={editor} />}
          />
        </CardContent>
      </Card>
    </Modal>
  );
};
