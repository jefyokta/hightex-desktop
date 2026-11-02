import type { ReactNode } from "react";
import logo from "@/assets/images/logo-uin.png";
import { name } from "@/utils/name";
import { ParsedItalic } from "@/utils/parse-italic";
import {
  displayDate,
  PERSON_LABELS,
  type FormData,
  type FormStage,
  type PersonKey,
} from "@/forms/model";

export function Letterhead() {
  return (
    <header className="form-letterhead">
      <img src={logo} alt="Logo UIN Sultan Syarif Kasim Riau" />
      <div className="form-letterhead-text">
        <div className="form-ministry">KEMENTERIAN AGAMA</div>
        <div className="form-university">
          UNIVERSITAS ISLAM NEGERI SULTAN SYARIF KASIM RIAU
        </div>
        <div className="form-faculty">FAKULTAS SAINS DAN TEKNOLOGI</div>
        <div className="form-arabic" lang="ar" dir="rtl">
          كلية العلوم والتكنولوجيا
        </div>
        <div className="form-faculty-en">FACULTY OF SCIENCE AND TECHNOLOGY</div>
        <address>
          Jl. H.R. Soebrantas Km. 15 Panam Pekanbaru PO. Box. 1004 Telp.
          0761-8359937
          <br />
          Fax. 0761-859428, Web Site: <span>www.uin-suska.ac.id</span>, e-mail:
          faste@uin-suska.ac.id
        </address>
      </div>
    </header>
  );
}
export function TitleValue({ text }: { text: string }) {
  return (
    <span className="form-title-value">
      {text.trim() ? <ParsedItalic text={text} /> : <BlankLine />}
    </span>
  );
}
export function BlankLine({ width }: { width?: string }) {
  return (
    <span
      className="form-blank-line"
      style={width ? { width } : undefined}
      aria-hidden="true"
    >
      &nbsp;
    </span>
  );
}
export function Details({
  rows,
  ruled = true,
}: {
  rows: [string, ReactNode][];
  ruled?: boolean;
}) {
  return (
    <table className={`form-details${ruled ? " form-details-ruled" : ""}`}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td className="form-colon">:</td>
            <td className="form-detail-value">{value || <BlankLine />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function Identity({
  data,
  program = false,
  uppercase = false,
  titleLines = false,
  ruled = true,
}: {
  data: FormData;
  program?: boolean;
  uppercase?: boolean;
  titleLines?: boolean;
  ruled?: boolean;
}) {
  const label = (text: string) => (uppercase ? text.toUpperCase() : text);
  return (
    <Details
      ruled={ruled}
      rows={[
        [label("Nama"), data.name],
        ["NIM", data.nim],
        ...(program
          ? [[label("Program Studi"), data.program] as [string, ReactNode]]
          : []),
        [
          label("Judul TA"),
          <div className={titleLines ? "form-long-title" : undefined}>
            <TitleValue text={data.title} />
          </div>,
        ],
      ]}
    />
  );
}
export function Schedule({
  data,
  ruled = true,
}: {
  data: FormData;
  ruled?: boolean;
}) {
  return (
    <Details
      ruled={ruled}
      rows={[
        ["Hari / Tanggal", displayDate(data.eventDate, true)],
        ["Tempat", data.eventPlace],
        ["Waktu", data.eventTime],
      ]}
    />
  );
}
export function Choice({
  checked,
  children,
}: {
  checked?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="form-choice">
      <span
        className="form-choice-box"
        aria-label={checked ? "Dipilih" : "Tidak dipilih"}
      >
        {checked ? "×" : ""}
      </span>
      {children}
    </span>
  );
}
export function StageChoices({
  stage,
  label = "Tahapan Pengujian",
}: {
  stage: FormStage;
  label?: string;
}) {
  return (
    <Details
      ruled={false}
      rows={[
        [
          label,
          <div className="form-stage-choices">
            <Choice checked={stage === "proposal"}>Seminar Proposal</Choice>
            <Choice checked={stage === "defense"}>Sidang Akhir</Choice>
          </div>,
        ],
      ]}
    />
  );
}
export function Signature({
  data,
  person,
  label,
  dated = false,
  knowing = false,
}: {
  data: FormData;
  person: PersonKey | "student";
  label?: string;
  dated?: boolean;
  knowing?: boolean;
}) {
  const student = person === "student";
  const displayName = student
    ? data.name
    : name(data.people[person].name.trim());
  const identity = student ? data.nim : data.people[person].nip;
  return (
    <div className="form-signature">
      {dated && (
        <div className="form-sign-date">
          {data.city},{" "}
          {data.signDate ? (
            displayDate(data.signDate)
          ) : (
            <BlankLine width="110pt" />
          )}
        </div>
      )}
      {knowing && <div>Mengetahui,</div>}
      <div className="form-sign-role">
        {label ?? (student ? "Mahasiswa" : PERSON_LABELS[person])}
      </div>
      <div className="form-sign-space" data-faculty-blank="signature" />
      <div className="form-sign-name">{displayName || <BlankLine />}</div>
      <div className="form-sign-nip">
        {student ? "NIM" : "NIP/NIK"}. {identity || <BlankLine />}
      </div>
    </div>
  );
}
export function RightSignature(props: Parameters<typeof Signature>[0]) {
  return (
    <div className="form-right-signature">
      <Signature {...props} />
    </div>
  );
}
export function FacultyBox({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <section className={`form-faculty-box ${className}`}>
      <h3>{label}</h3>
      <div data-faculty-blank={label} />
    </section>
  );
}
