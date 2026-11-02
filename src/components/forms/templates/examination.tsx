import { name } from "@/utils/name";
import {
  committee,
  displayDate,
  hasSecondAdvisor,
  PERSON_LABELS,
  type FormData,
  type FormStage,
  type PersonKey,
} from "@/forms/model";
import {
  BlankLine,
  FacultyBox,
  Identity,
  RightSignature,
  Schedule,
  StageChoices,
} from "../form-elements";

export function EventAttendance({
  data,
  stage,
}: {
  data: FormData;
  stage: FormStage;
}) {
  const members = committee(data);
  return (
    <>
      <p>
        Telah dilakukan {stage === "proposal" ? "Seminar Proposal" : "Sidang"}{" "}
        Tugas Akhir, atas mahasiswa:
      </p>
      <Identity data={data} />
      <Schedule data={data} />
      <p>Yang dihadiri oleh:</p>
      <table className="form-grid form-event-attendance">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "45%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>NO</th>
            <th>DOSEN</th>
            <th>NIP / NIK</th>
            <th>TANDA TANGAN</th>
          </tr>
        </thead>
        <tbody>
          {members.map((key, i) => (
            <tr key={key}>
              <td>{i + 1}</td>
              <td>{name(data.people[key].name)}</td>
              <td>{data.people[key].nip}</td>
              <td data-faculty-blank="lecturer-attendance" />
            </tr>
          ))}
        </tbody>
      </table>
      <table className="form-grid form-event-attendance">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "45%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>NO</th>
            <th>MAHASISWA**</th>
            <th>NIM</th>
            <th>TANDA TANGAN</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td />
              <td />
              <td data-faculty-blank="student-attendance" />
            </tr>
          ))}
        </tbody>
      </table>
      <RightSignature
        data={data}
        person="chair"
        label="Ketua Seminar Proposal / Sidang"
      />
    </>
  );
}
export function EventMinutes({
  data,
  stage,
}: {
  data: FormData;
  stage: FormStage;
}) {
  const signatureRows: (PersonKey | "student" | null)[][] = [
    ["chair", "examiner1", "examiner2"],
    ["advisor1", hasSecondAdvisor(data) ? "advisor2" : null, "student"],
  ];
  const signerName = (person: PersonKey | "student") =>
    person === "student" ? data.name : name(data.people[person].name.trim());
  const signerIdentity = (person: PersonKey | "student") =>
    person === "student" ? data.nim : data.people[person].nip;
  return (
    <>
      <p>
        Pada hari ini, telah dilaksanakan Ujian{" "}
        {stage === "proposal" ? "Seminar Proposal" : "Sidang"} Tugas Akhir (TA),
        pada:
      </p>
      <Schedule data={data} ruled={false} />
      <p>Atas nama mahasiswa berikut ini:</p>
      <Identity data={data} ruled={false} />
      <FacultyBox
        label="Dengan komentar / saran untuk ditindaklanjuti (diisi oleh masing-masing penguji):"
        className="form-minutes-comments"
      />
      <p>
        Harus diperbaiki dalam jangka waktu <BlankLine width="100pt" />
      </p>
      <p>
        {data.city},{" "}
        {data.signDate ? (
          displayDate(data.signDate)
        ) : (
          <BlankLine width="120pt" />
        )}
      </p>
      <p>Mengetahui,</p>
      <table
        className="form-minutes-signatures"
        aria-label="Pengesahan berita acara"
      >
        {signatureRows.map((people, index) => (
          <tbody key={index}>
            {index > 0 && (
              <tr className="form-minutes-row-gap" aria-hidden="true">
                <td colSpan={3} />
              </tr>
            )}
            <tr className="form-minutes-roles">
              {people.map((person, column) => (
                <th key={column} scope="col">
                  {person === "student"
                    ? "Mahasiswa"
                    : person === "chair"
                      ? "Ketua Sempro/Sidang"
                      : person && PERSON_LABELS[person]}
                </th>
              ))}
            </tr>
            <tr className="form-minutes-sign-spaces">
              {people.map((person, column) => (
                <td
                  key={column}
                  data-faculty-blank={person ? "signature" : undefined}
                />
              ))}
            </tr>
            <tr className="form-minutes-names">
              {people.map((person, column) => (
                <td key={column} className="form-sign-name">
                  {person &&
                    (signerName(person) || <BlankLine width="100pt" />)}
                </td>
              ))}
            </tr>
            <tr className="form-minutes-identities">
              {people.map((person, column) => (
                <td key={column} className="form-sign-nip">
                  {person && (
                    <>
                      {person === "student" ? "NIM" : "NIP/NIK"}.{" "}
                      {signerIdentity(person) || <BlankLine width="75pt" />}
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
    </>
  );
}
export function ScoreRecap({
  data,
  stage,
}: {
  data: FormData;
  stage: FormStage;
}) {
  const members = committee(data);
  return (
    <>
      <Schedule data={data} />
      <p>
        Telah dilakukan {stage === "proposal" ? "Seminar Proposal" : "Sidang"}{" "}
        Tugas Akhir mahasiswa:
      </p>
      <Identity data={data} />
      <StageChoices stage={stage} />
      <p>Dengan hasil sebagai berikut:</p>
      <table className="form-grid form-score-recap">
        <colgroup>
          <col style={{ width: "10%" }} />
          <col style={{ width: "68%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>No.</th>
            <th>TIM PENGUJI</th>
            <th>NILAI</th>
          </tr>
        </thead>
        <tbody>
          {members.map((key, i) => (
            <tr key={key}>
              <td>{i + 1}</td>
              <td>
                {key === "advisor1"
                  ? "SEKRETARIS / PEMBIMBING I"
                  : PERSON_LABELS[key].toUpperCase()}
              </td>
              <td data-faculty-blank="recap-score" />
            </tr>
          ))}
          <tr>
            <td>{members.length + 1}</td>
            <td>NILAI RATA-RATA</td>
            <td data-faculty-blank="recap-average" />
          </tr>
        </tbody>
      </table>
      <div className="form-notes">
        <p>*) Coret yang tidak perlu.</p>
        <p>Jika ada Pembimbing II, maka total dibagi 5.</p>
      </div>
      <RightSignature
        data={data}
        person="chair"
        label="Ketua Ujian Proposal / Sidang"
        dated
      />
    </>
  );
}
