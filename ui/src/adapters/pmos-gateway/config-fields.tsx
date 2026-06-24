import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

export function PmosGatewayConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="PM-OS API URL">
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://localhost:8080"
        />
      </Field>

      <SecretField
        label="PM-OS API Key"
        value={
          isCreate
            ? values!.apiKey ?? ""
            : eff("adapterConfig", "apiKey", String(config.apiKey ?? ""))
        }
        onCommit={(v) =>
          isCreate
            ? set!({ apiKey: v })
            : mark("adapterConfig", "apiKey", v || undefined)
        }
        placeholder="pmos_local_dev_key"
      />

      {!isCreate && (
        <>
          <Field label="Default recipe slug (optional)">
            <DraftInput
              value={eff("adapterConfig", "recipe", String(config.recipe ?? ""))}
              onCommit={(v) => mark("adapterConfig", "recipe", v || undefined)}
              immediate
              className={inputClass}
              placeholder="e.g. briefing-diario"
            />
          </Field>

          <Field label="Default intent (optional, when no recipe)">
            <DraftInput
              value={eff("adapterConfig", "intent", String(config.intent ?? ""))}
              onCommit={(v) => mark("adapterConfig", "intent", v || undefined)}
              immediate
              className={inputClass}
              placeholder="e.g. Summarize the latest sales data"
            />
          </Field>

          <Field label="Paperclip API URL override">
            <DraftInput
              value={eff(
                "adapterConfig",
                "paperclipApiUrl",
                String(config.paperclipApiUrl ?? ""),
              )}
              onCommit={(v) => mark("adapterConfig", "paperclipApiUrl", v || undefined)}
              immediate
              className={inputClass}
              placeholder="http://localhost:3100"
            />
          </Field>
        </>
      )}
    </>
  );
}
