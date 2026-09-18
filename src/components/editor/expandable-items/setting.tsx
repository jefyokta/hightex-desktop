import { useEffect, useMemo, useState } from "react";
import { FileWarningIcon, Save, X } from "lucide-react";

import { Document } from "@/editor/document";
import { HighTexDB } from "@/editor/storage/hightex-db";

import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabHeader } from "./components/tab-header";
import { DatePickerInput } from "@/components/ui/date-picker";

export const Setting = () => {
  const db = HighTexDB.getInstance();

  const [doc, setDoc] = useState<HighTexDocument | null>(null);

  const [original, setOriginal] = useState("");

  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const docId = Document.instance?.id ?? Document.current?.getDocumentId();
      if (!docId) return;

      const initial = await db.documents.get(docId);

      if (!initial || !mounted) return;

      const ct = await window.hightex.categories();

      if (!mounted) return;

      setCategories(ct || []);
      setDoc(initial);
      setOriginal(JSON.stringify(initial));
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!doc) return false;

    return JSON.stringify(doc) !== original;
  }, [doc, original]);

  const save = async () => {
    if (!doc) return;

    setLoading(true);

    try {
      await db.updateDocument(doc);

      setOriginal(JSON.stringify(doc));
    } finally {
      setLoading(false);
    }
  };

  if (!doc) return null;

  const docConfig = doc.config ?? ({} as NonNullable<HighTexDocument["config"]>);
  const docKeywords = doc.keywords ?? { indonesian: [], english: [] };

  const selectedCategory = categories.find(
    (category) => String(category.id) === String(doc.category),
  );
  const isInternDoc =
    selectedCategory?.variant === "intern" || Boolean(docConfig?.intern);

  return (
    <div className="flex h-full flex-col bg-background">
      <TabHeader title={t("editor.expandable.setting.title")} desc={doc.title}>
        <div className="flex justify-end space-x-1 items-center">
          {isDirty && (
            <Badge className=" gap-1 border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-300">
              <FileWarningIcon className="h-1.5 w-1.5 " />
              {t("editor.expandable.setting.unsaved")}
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={!isDirty || loading}
            onClick={save}
            className="gap-1"
          >
            <Save className="h-3 w-3" />

            {loading
              ? t("editor.expandable.setting.saving")
              : t("editor.expandable.setting.save")}
          </Button>
        </div>
      </TabHeader>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <Section title={t("editor.expandable.setting.document")}>
          <Field
            label={t("editor.expandable.setting.title_label")}
            value={doc.title ?? ""}
            onChange={(title) =>
              setDoc((prev) => ({
                ...prev!,
                title,
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.alt_title")}
            value={doc.altTitle ?? ""}
            onChange={(altTitle) =>
              setDoc((prev) => ({
                ...prev!,
                altTitle,
              }))
            }
          />

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground ">
              {t("editor.expandable.setting.category")}
            </label>

            <Select
              value={String(doc.category ?? "1")}
              onValueChange={(value) =>
                setDoc((prev) => {
                  const nextCategory = categories.find(
                    (category) => String(category.id) === value,
                  );

                  return {
                    ...prev!,
                    category: value,
                    config: {
                      ...prev!.config,
                      intern:
                        nextCategory?.variant === "intern"
                          ? (prev!.config?.intern ?? {})
                          : prev!.config?.intern,
                    },
                  };
                })
              }
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue
                  placeholder={t("editor.expandable.setting.select_category")}
                />
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}{category.variant ? ` - ${t(`common.${category.variant}`)}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title={t("editor.expandable.setting.keywords")}>
          <KeywordBox
            label={t("editor.expandable.setting.indonesian")}
            values={docKeywords.indonesian ?? []}
            onChange={(values) =>
              setDoc((prev) => ({
                ...prev!,
                keywords: {
                  ...prev!.keywords,
                  indonesian: values.slice(0, 5),
                },
              }))
            }
            render={(value) => <ParsedItalic text={value} />}
          />

          <KeywordBox
            label={t("editor.expandable.setting.english")}
            values={docKeywords.english ?? []}
            onChange={(values) =>
              setDoc((prev) => ({
                ...prev!,
                keywords: {
                  ...prev!.keywords,
                  english: values.slice(0, 5),
                },
              }))
            }
            render={(value) => <em>{value}</em>}
          />
        </Section>

        <Section
          title={t("editor.expandable.setting.thesis_examination_committee")}
        >
          <Field
            label={t("editor.expandable.setting.leaded_by")}
            value={docConfig.leader ?? ""}
            onChange={(leader) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  leader,
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.primary_examiner_name")}
            value={docConfig.member_1 ?? ""}
            onChange={(member_1) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  member_1,
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.secondary_examiner_name")}
            value={docConfig.member_2 ?? ""}
            onChange={(member_2) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  member_2,
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.kaprodi_name")}
            value={docConfig.kaprodi?.name ?? ""}
            onChange={(name) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  kaprodi: {
                    ...prev?.config?.kaprodi,
                    name,
                  },
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.kaprodi_nip")}
            value={docConfig.kaprodi?.nip ?? ""}
            onChange={(nip) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  kaprodi: {
                    ...prev?.config?.kaprodi,
                    nip,
                  },
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.dekan_name")}
            value={docConfig.dekan?.name ?? ""}
            onChange={(name) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  dekan: {
                    ...prev?.config?.dekan,
                    name,
                  },
                },
              }))
            }
          />

          <Field
            label={t("editor.expandable.setting.dekan_nip")}
            value={docConfig.dekan?.nip ?? ""}
            onChange={(nip) =>
              setDoc((prev) => ({
                ...prev!,
                config: {
                  ...prev?.config,
                  dekan: {
                    ...prev?.config?.dekan,
                    nip,
                  },
                },
              }))
            }
          />
        </Section>

        <Section title={t("editor.expandable.setting.thesis_dates")}>
          <DatePickerInput
            label={t("editor.expandable.setting.consent_date")}
            date={docConfig.consentDate}
            setDate={(date) => {
              setDoc((prv) => {
                return {
                  ...prv!,
                  config: {
                    ...prv?.config,
                    consentDate: date,
                  },
                };
              });
            }}
          />

          <DatePickerInput
            label={t("editor.expandable.setting.validity_date")}
            date={docConfig.validityDate}
            setDate={(date) => {
              setDoc((prv) => {
                return {
                  ...prv!,
                  config: {
                    ...prv?.config,
                    validityDate: date,
                  },
                };
              });
            }}
          />

          <DatePickerInput
            label={t("editor.expandable.setting.statement_date")}
            date={docConfig.statementDate}
            setDate={(date) => {
              setDoc((prv) => {
                return {
                  ...prv!,
                  config: {
                    ...prv?.config,
                    statementDate: date,
                  },
                };
              });
            }}
          />
        </Section>

        {isInternDoc && (
          <Section title={t("editor.expandable.setting.intern_document_info")}>
            <Field
              label={t("editor.expandable.setting.onsite_location")}
              value={docConfig.intern?.onsite_at ?? ""}
              onChange={(onsite_at) =>
                setDoc((prev) => ({
                  ...prev!,
                  config: {
                    ...prev?.config,
                    intern: {
                      ...prev?.config?.intern,
                      onsite_at,
                    },
                  },
                }))
              }
            />

            <Field
              label={t("editor.expandable.setting.internship_advisor_name")}
              value={docConfig.intern?.advisor?.name ?? ""}
              onChange={(name) =>
                setDoc((prev) => ({
                  ...prev!,
                  config: {
                    ...prev?.config,
                    intern: {
                      ...prev?.config?.intern,
                      advisor: {
                        ...prev?.config?.intern?.advisor,
                        name,
                      },
                    },
                  },
                }))
              }
            />

            <Field
              label={t("editor.expandable.setting.internship_advisor_nip")}
              value={docConfig.intern?.advisor?.nip ?? ""}
              onChange={(nip) =>
                setDoc((prev) => ({
                  ...prev!,
                  config: {
                    ...prev?.config,
                    intern: {
                      ...prev?.config?.intern,
                      advisor: {
                        ...prev?.config?.intern?.advisor,
                        nip,
                      },
                    },
                  },
                }))
              }
            />

            <DatePickerInput
              label={t("editor.expandable.setting.intern_validity_date")}
              date={docConfig.intern?.validity}
              setDate={(date) => {
                setDoc((prv) => ({
                  ...prv!,
                  config: {
                    ...prv?.config,
                    intern: {
                      ...prv?.config?.intern,
                      validity: date,
                    },
                  },
                }));
              }}
            />
          </Section>
        )}
      </div>
    </div>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <Card className="bg-muted/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
};

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div>
      <label className="text-xs text-muted-foreground ">{label}</label>

      <Input
        className="text-muted- mt-1 bg-muted/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

const KeywordBox = ({
  label,
  values = [],
  onChange,
  render,
}: {
  label: string;
  values?: string[];
  onChange: (values: string[]) => void;
  render: (value: string) => React.ReactNode;
}) => {
  const [input, setInput] = useState("");
  const list = Array.isArray(values) ? values : [];

  const add = () => {
    const value = input.trim();

    if (!value) return;

    if (list.includes(value)) return;

    if (list.length >= 5) return;

    onChange([...list, value]);

    setInput("");
  };

  const remove = (value: string) => {
    onChange(list.filter((item) => item !== value));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>

      <div className="flex flex-wrap gap-2">
        {list.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 px-2 py-1">
            {render(value)}

            <button
              type="button"
              onClick={() => remove(value)}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <Input
        value={input}
        placeholder={t("editor.expandable.setting.add_keyword")}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
};
