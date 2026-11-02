import { name } from "@/utils/name";
import {
  displayDate,
  PERSON_LABELS,
  type FormData,
  type FormStage,
  type PersonKey,
} from "@/forms/model";
import {
  BlankLine,
  Details,
  FacultyBox,
  Identity,
  RightSignature,
  Signature,
  TitleValue,
} from "../form-elements";

export function SeminarAttendanceCard({ data }: { data: FormData }) {
  return (
    <>
      <Details
        rows={[
          ["NAMA", data.name],
          ["NIM", data.nim],
          ["JURUSAN", data.program],
        ]}
      />
      <p>Telah menghadiri Seminar Proposal Tugas Akhir mahasiswa,</p>
      <table className="form-grid form-seminar-attendance">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>NO</th>
            <th>NAMA MAHASISWA</th>
            <th>NIM</th>
            <th>JUR/PRODI</th>
            <th>TGL</th>
            <th>NAMA PEMBIMBING</th>
            <th>PARAF</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              <td>{index + 1}.</td>
              <td>
                <div
                  className="form-attendee-name"
                  data-faculty-blank="student"
                />
                <div>Judul TA:</div>
                <div data-faculty-blank="attended-title" />
              </td>
              <td />
              <td />
              <td />
              <td />
              <td data-faculty-blank="initials" />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form-notes">
        <p>Keterangan:</p>
        <p>*) Coret yang tidak perlu</p>
        <p>
          **) Bukti hadir mahasiswa diparaf oleh pembimbing mahasiswa yang
          melakukan seminar.
        </p>
      </div>
    </>
  );
}
export function InternshipCompletion({ data }: { data: FormData }) {
  const programs = [
    "TEKNIK INFORMATIKA",
    "TEKNIK INDUSTRI",
    "SISTEM INFORMASI",
    "TEKNIK ELEKTRO",
    "MATEMATIKA",
  ];
  return (
    <>
      <table className="form-grid form-internship-identity">
        <tbody>
          <tr>
            <th scope="row">NAMA</th>
            <td>{data.name || <BlankLine />}</td>
          </tr>
          <tr>
            <th scope="row">NIM</th>
            <td>{data.nim || <BlankLine />}</td>
          </tr>
          <tr>
            <th scope="row">PROGRAM STUDI*)</th>
            <td>
              <ol>
                {programs.map((program) => (
                  <li key={program}>
                    <span
                      className={
                        program.toLowerCase() === data.program.toLowerCase()
                          ? "form-circled-program"
                          : undefined
                      }
                    >
                      {program}
                    </span>
                  </li>
                ))}
              </ol>
            </td>
          </tr>
          <tr>
            <th scope="row">IPK / JUMLAH SKS</th>
            <td>
              {data.gpa || <BlankLine width="40pt" />} /{" "}
              {data.credits || <BlankLine width="40pt" />}
            </td>
          </tr>
        </tbody>
      </table>
      <section className="form-internship-title">
        <h3>JUDUL LAPORAN KP:</h3>
        <div>
          <TitleValue text={data.internTitle} />
        </div>
      </section>
      <p className="form-internship-statement">
        DOSEN PEMBIMBING KP MAHASISWA BERSANGKUTAN MENERANGKAN BAHWA MAHASISWA
        YANG TERSEBUT, BELUM / TELAH **) MENYERAHKAN LAPORAN KP DAN DISETUJUI
        OLEH DOSEN PEMBIMBING KP MAHASISWA BERSANGKUTAN PADA:
      </p>
      <div className="form-internship-date">
        <Details
          rows={[
            [
              "Hari",
              data.internDate
                ? new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(
                    new Date(`${data.internDate}T12:00:00`),
                  )
                : "",
            ],
            ["Tanggal", displayDate(data.internDate)],
          ]}
        />
      </div>
      <div className="form-signatures form-internship-signatures">
        <Signature
          data={data}
          person="head"
          label="Ketua Program Studi"
          knowing
        />
        <Signature
          data={data}
          person="internAdvisor"
          label="Dosen Pembimbing"
          dated
        />
      </div>
      <div className="form-notes">
        <p>Keterangan:</p>
        <p>*) Lingkari jurusan yang sesuai;</p>
        <p>**) Coret yang tidak perlu;</p>
      </div>
    </>
  );
}
export function GuidanceCard({
  data,
  recipient,
}: {
  data: FormData;
  recipient: PersonKey;
}) {
  return (
    <>
      <Identity data={data} uppercase titleLines />
      <Details
        rows={[
          [
            PERSON_LABELS[recipient].toUpperCase(),
            name(data.people[recipient].name),
          ],
        ]}
      />
      <table className="form-grid form-guidance">
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "44%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2}>BIMBINGAN LAPORAN*</th>
            <th rowSpan={2}>NO</th>
            <th rowSpan={2}>
              KOMENTAR PERBAIKAN / TAMBAHAN ISI LAPORAN TUGAS AKHIR
            </th>
            <th rowSpan={2}>TANGGAL</th>
            <th colSpan={2}>PARAF PEMBIMBING</th>
          </tr>
          <tr>
            <th>Proposal</th>
            <th>Sidang</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              <td>BAB</td>
              <td />
              <td data-faculty-blank="guidance-comment" />
              <td />
              <td data-faculty-blank="proposal-initials" />
              <td data-faculty-blank="defense-initials" />
            </tr>
          ))}
        </tbody>
      </table>
      <table className="form-grid form-guidance-approval">
        <tbody>
          <tr>
            <td>
              Disetujui Pembimbing I untuk Seminar Proposal / Sidang Tugas Akhir
            </td>
            <td data-faculty-blank="approval" />
          </tr>
          <tr>
            <td>
              Disetujui Pembimbing II untuk Seminar Proposal / Sidang Tugas
              Akhir
            </td>
            <td data-faculty-blank="approval" />
          </tr>
        </tbody>
      </table>
      <Details rows={[["PEMBIMBING II", name(data.people.advisor2.name)]]} />
      <div className="form-notes">
        <p>Keterangan:</p>
        <p>*) Diisi oleh pembimbing</p>
        <p>Syarat jumlah minimal proses bimbingan:</p>
        <ul>
          <li>Seminar Proposal: 5 kali</li>
          <li>
            Sidang TA: 10 kali (dihitung dari mulai bimbingan tahap proposal)
          </li>
        </ul>
        <p>
          Lembar ini diperbanyak sendiri oleh mahasiswa sesuai kebutuhan
          bimbingan.
        </p>
      </div>
    </>
  );
}
export function RevisionProof({
  data,
  stage,
  recipient,
}: {
  data: FormData;
  stage: FormStage;
  recipient: PersonKey;
}) {
  return (
    <>
      <Identity data={data} program uppercase titleLines />
      <Details
        rows={[["TAHAPAN", stage === "proposal" ? "PROPOSAL" : "SIDANG"]]}
      />
      <div className="form-revision-boxes">
        <FacultyBox label="PERBAIKAN" />
        <FacultyBox label="KOMENTAR" />
      </div>
      <RightSignature data={data} person={recipient} dated />
      <p className="form-notes">* Coret yang tidak perlu.</p>
    </>
  );
}
