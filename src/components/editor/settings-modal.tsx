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
import { SettingSwitch } from "@/pages/settings";
import { Manager } from "@/editor/manager";

type SettingModalProps = {
  open?: boolean;
  onClose?: () => void;
};

export const SettingModal: React.FC<SettingModalProps> = ({
  open = false,
  onClose = () => {},
}) => {
  const { config, saveConfig } = useConfig();

  const saveEditor = async (
    patch: Partial<NonNullable<ConfigShape["editor"]>>,
  ): Promise<void> => {
    await saveConfig({
      editor: {
        ...config?.editor,
        ...patch,
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Card className="m-2">
        <CardHeader>
          <CardTitle>{t("settings.editor.title")}</CardTitle>
          <CardDescription>{t("settings.editor.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SettingSwitch
            label={t("settings.editor.spell_check")}
            value={config?.editor?.spellCheck ?? false}
            onChange={(value) =>
              saveEditor({
                spellCheck: value,
              })
            }
          />

          <SettingSwitch
            label={t("settings.editor.scrollbar")}
            value={config?.editor?.scrollBar ?? false}
            onChange={(value) =>
              saveEditor({
                scrollBar: value,
              })
            }
          />

          <SettingSwitch
            label={
              <>
                {/* note for translator: alias = singkatan */}
                <span>Enable Alias Hints</span>
              </>
            }
            description="Show the meaning of words defined in your Aliases List when you hover over them in the editor."
            value={config?.editor?.aliasHint ?? false}
            onChange={(value) => {
              saveEditor({
                aliasHint: value,
              }).then(() => {
                Manager.app.dispatch("chapter:reload", {});
              });
            }}
          />
        </CardContent>
      </Card>
    </Modal>
  );
};
