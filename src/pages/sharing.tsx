import { PageHeader } from "@/components/dashboard/page-header";
import { useEffect, useState } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/animate-ui/components/buttons/copy";
import { useNavigate } from "react-router-dom";
import { sharingTypeLabel } from "@/utils/sharing-labels";
import { RoleBadge } from "@/components/sharing/role-bage";
import { ShouldNotifiedWithNativeComponent } from "@/exception/interfaces/should-notified-with-native-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { connectToHost } from "@/utils/sharing";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { toast } from "sonner";
import { t, useAppLanguage, type LocaleKey } from "@/utils/lang";
import { ParsedItalic } from "@/utils/parse-italic";

const sharingType: { type: SharingType; key: LocaleKey }[] = [
  {
    type: "advising",
    key: "present.type_advising",
  },
  {
    type: "proposalSeminar",
    key: "present.type_proposal_seminar",
  },
  {
    type: "finalDefense",
    key: "present.type_final_defense",
  },
];

export const Present = () => {
  useAppLanguage();
  const [docs, setDocs] = useState<HighTexDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [activeSession, setActiveSession] = useState<
    SharingInformation | undefined
  >();

  const [initialized, setInitialized] = useState(false);

  const [invitation, setInvitation] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    let mounted = true;

    window.sharing
      .info()
      .then((info) => {
        if (!mounted) return;

        if (info) {
          setActiveSession(info);
        }
      })
      .finally(() => {
        if (mounted) {
          setInitialized(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeSession) {
      return;
    }

    HighTexDB.getMainDocuments().then(setDocs);
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) {
      return;
    }

    window.hightex
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [activeSession]);

  if (!initialized) {
    return (
      <div className="flex justify-center py-10">{t("common.loading")}</div>
    );
  }

  if (activeSession) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("workspace.tools")}
          title={t("present.title")}
          description={t("present.session_active")}
        />

        <SharingInfo
          session={activeSession}
          onClose={async () => {
            await window.sharing.stop();
            setActiveSession(await window.sharing.info());
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("workspace.tools")}
        title={t("present.title")}
        description={t("present.subtitle")}
        actions={
          <Dialog>
            <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
              {t("present.join")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("present.join_session")}</DialogTitle>
                <DialogDescription>
                  {t("present.join_description")}
                </DialogDescription>
              </DialogHeader>
              <Input
                value={invitation}
                onChange={(e) => setInvitation(e.target.value)}
                placeholder={t("present.invitation_code")}
              ></Input>
              <Button
                onClick={async () => {
                  const id = toast.loading(t("present.loading"));
                  try {
                    const inv = await connectToHost(invitation);

                    nav(`/share/${inv.ip}/${inv.port}/${inv.code ?? ""}`);
                  } catch (error) {
                    throw new ShouldNotified({
                      description: String(error),
                      message: t("present.join_failed"),
                    });
                  } finally {
                    toast.dismiss(id);
                    setInvitation("");
                  }
                }}
              >
                {t("present.join")}
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      {docs.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          {t("present.no_documents")}
        </div>
      ) : (
        <div className="space-y-4 bg-neutral-50 dark:bg-neutral-900 h-full rounded-2xl p-5">
          {docs.map((doc) => (
            <ShareDocument
              key={doc.id}
              document={doc}
              categories={categories}
              onStarted={setActiveSession}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ShareDocument = ({
  document,
  categories,
  onStarted,
}: {
  document: HighTexDocument;
  categories: Category[];
  onStarted(session: SharingInformation): void;
}) => {
  const [type, setType] = useState<SharingType>();
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!type) {
      return;
    }

    try {
      setLoading(true);

      const snapshot = await window.sharing.html(document.id);
      const imgs = await HighTexDB.getInstance()
        .images.where("documentId")
        .equals(document.id)
        .toArray();
      const images = await Promise.all(
        imgs.map(async ({ id, blob }) => {
          const buffer = new Uint8Array(await blob.arrayBuffer());
          return { id, buffer } satisfies SerialableImageRecord;
        }),
      );

      const res = await window.sharing.start({
        type,
        snapshot,
        images,
        document: { ...document, profile: undefined },
      });
      if ("message" in res) {
        throw new ShouldNotifiedWithNativeComponent(res.message);
      }

      const info = await window.sharing.info();

      if (info) {
        onStarted(info);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg  p-4">
      <div>
        <div className="text-xs text-muted-foreground">
          {categories.find((c) => String(c.id) === document.category)?.name ??
            t("sharing.uncategorized")}
        </div>

        <div className="font-medium">
          <ParsedItalic text={document.title} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={type} onValueChange={(v) => setType(v as SharingType)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("sharing.type")} />
          </SelectTrigger>

          <SelectContent>
            {sharingType.map((item) => (
              <SelectItem key={item.type} value={item.type}>
                {t(item.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button disabled={!type || loading} onClick={start}>
          {loading ? t("sharing.starting") : t("sharing.start")}
        </Button>
      </div>
    </div>
  );
};

const SharingInfo = ({
  session,
  onClose,
}: {
  session: SharingInformation;
  onClose(): void;
}) => {
  const go = useNavigate();

  return (
    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("sharing.active_session")}</h3>

          <p className="text-sm text-muted-foreground">
            <ParsedItalic text={session.document.title} />
          </p>
        </div>
        <div className="space-x-1">
          <Button variant="destructive" size="sm" onClick={() => onClose()}>
            {t("sharing.stop")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              return go("/shared");
            }}
          >
            {t("sharing.open")}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-black/5 dark:bg-white/3  p-3">
          <div className="text-xs text-muted-foreground">
            {t("sharing.session_type")}
          </div>

          <div className="font-medium">{sharingTypeLabel(session.type)}</div>
        </div>

        <div className="rounded-lg bg-black/5 dark:bg-white/3 p-3">
          <div className="text-xs text-muted-foreground">
            {t("sharing.address")}
          </div>

          <div className="font-mono text-sm">{session.host}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-medium">{t("sharing.invitation_codes")}</div>

        {session.guest.map((guest) => (
          <div
            key={guest.code}
            className="flex items-center justify-between rounded-xl bg-black/5 dark:bg-white/3 p-3"
          >
            <RoleBadge role={guest.role} />
            <div className="flex items-center space-x-2">
              <code className="text-xs">{guest.code}</code>
              <CopyButton content={guest._code!} size={"xxs"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
