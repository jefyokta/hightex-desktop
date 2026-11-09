export interface MacInstallJob {
  nonce: string;
  pid: number;
  uid: number;
  target: string;
  source: string;
  ready: string;
  commit: string;
  abort: string;
  ack: string;
  result: string;
  version: string;
}

const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

/** Tools/timings are injectable so the same replacement protocol can be tested in temp directories. */
export function macInstallScript(
  job: MacInstallJob,
  options: {
    copy?: string[];
    open?: string[];
    sleep?: number;
    quitAttempts?: number;
    launchAttempts?: number;
  } = {},
) {
  const copy = (options.copy ?? ["/usr/bin/ditto"]).map(quote).join(" ");
  const open = (options.open ?? ["/usr/bin/open", "-n"]).map(quote).join(" ");
  const pause = options.sleep ?? 1;
  const quitAttempts = options.quitAttempts ?? 900;
  const launchAttempts = options.launchAttempts ?? 90;
  if (
    !Number.isInteger(job.pid) ||
    job.pid <= 1 ||
    !Number.isInteger(job.uid) ||
    job.uid < 0 ||
    !/^[a-f0-9-]{36}$/.test(job.nonce)
  )
    throw Error("Invalid update job.");
  for (const value of Object.values(job))
    if (typeof value === "string" && /[\0\r\n]/.test(value))
      throw Error("Invalid update path.");
  return `#!/bin/bash
set -u
umask 077
nonce=${quote(job.nonce)}
target=${quote(job.target)}
source=${quote(job.source)}
backup="$target.hightex-backup-$nonce"
next="$target.hightex-next-$nonce"
failed="$target.hightex-failed-$nonce"
ready=${quote(job.ready)}
commit=${quote(job.commit)}
abort=${quote(job.abort)}
ack=${quote(job.ack)}
result=${quote(job.result)}
write_result() { printf '%s' "$1" > "$result"; }
open_app() {
  if [ "$(/usr/bin/id -u)" = "${job.uid}" ]; then
    ${open} "$target"
  else
    /bin/launchctl asuser ${job.uid} /usr/bin/sudo -u ${quote("#" + job.uid)} ${open} "$target"
  fi
}
cancelled() { [ "$(/bin/cat "$abort")" = "$nonce" ]; }
printf '%s' "$nonce" > "$ready"
remaining=${quitAttempts}
while kill -0 ${job.pid} 2>/dev/null; do
  if cancelled; then write_result cancelled; exit 0; fi
  remaining=$((remaining - 1))
  if [ "$remaining" -le 0 ]; then write_result quit-timeout; exit 1; fi
  /bin/sleep ${pause}
done
if cancelled || [ "$(/bin/cat "$commit")" != "$nonce" ]; then write_result cancelled; exit 0; fi
# Never remove the installed bundle before a complete replacement exists beside it.
if [ ! -d "$target" ] || [ -L "$target" ] || [ -e "$next" ] || [ -e "$backup" ] || [ -e "$failed" ]; then
  write_result invalid-target; exit 1
fi
if ! ${copy} "$source" "$next"; then
  /bin/rm -rf "$next"; write_result copy-failed; open_app; exit 1
fi
if ! /bin/mv "$target" "$backup"; then
  /bin/rm -rf "$next"; write_result backup-failed; open_app; exit 1
fi
if ! /bin/mv "$next" "$target"; then
  /bin/mv "$backup" "$target"; write_result replace-failed; open_app; exit 1
fi
write_result installed
open_app || true
remaining=${launchAttempts}
while [ "$remaining" -gt 0 ]; do
  if [ "$(/bin/cat "$ack")" = "$nonce" ]; then
    write_result complete
    /bin/rm -rf "$backup"
    /bin/rm -rf "$source"
    /bin/rm -f "$(/usr/bin/dirname "$source")/update.dmg"
    exit 0
  fi
  remaining=$((remaining - 1))
  /bin/sleep ${pause}
done
# The new app never confirmed startup: preserve it for diagnostics and restore the old bundle.
if /bin/mv "$target" "$failed" && /bin/mv "$backup" "$target"; then
  write_result rolled-back
  open_app || true
else
  write_result rollback-failed
fi
exit 1
`;
}
