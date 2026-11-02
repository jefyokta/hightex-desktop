import { Fragment } from "react";
import {
  ADVISOR_RUBRIC,
  CHAIR_RUBRIC,
  EXAM_RUBRIC,
  type AssessmentSection,
} from "@/forms/assessment-rubrics";
import {
  hasSecondAdvisor,
  PERSON_LABELS,
  type FormData,
  type FormStage,
  type PersonKey,
} from "@/forms/model";
import {
  BlankLine,
  Choice,
  Identity,
  RightSignature,
  Signature,
  StageChoices,
  TitleValue,
} from "../form-elements";

function AssessmentTable({ sections }: { sections: AssessmentSection[] }) {
  return (
    <table className="form-grid form-assessment">
      <colgroup>
        <col style={{ width: "61%" }} />
        <col style={{ width: "13%" }} />
        <col style={{ width: "13%" }} />
        <col style={{ width: "13%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>KRITERIA PENILAIAN</th>
          <th>
            SKOR
            <br />
            <small>50 s.d. 100</small>
          </th>
          <th>NILAI BOBOT</th>
          <th>NILAI AKHIR</th>
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <Fragment key={section.title}>
            <tr className="form-assessment-section">
              <th colSpan={4}>{section.title}</th>
            </tr>
            {section.criteria.map((criterion, i) => (
              <tr key={criterion.label}>
                <td>
                  {i + 1}. {criterion.label}
                </td>
                <td data-faculty-blank="criterion-score" />
                <td className="form-center">{criterion.weight}%</td>
                <td data-faculty-blank="weighted-score" />
              </tr>
            ))}
            <tr>
              <td className="form-subtotal">Sub Total</td>
              <td />
              <td className="form-center">
                {section.criteria.reduce(
                  (sum, criterion) => sum + criterion.weight,
                  0,
                )}
                %
              </td>
              <td data-faculty-blank="subtotal" />
            </tr>
          </Fragment>
        ))}
        <tr>
          <th>TOTAL NILAI</th>
          <td />
          <th>100%</th>
          <td data-faculty-blank="total-score" />
        </tr>
      </tbody>
    </table>
  );
}
function AssessmentNotes() {
  return (
    <div className="form-notes">
      <p>Keterangan:</p>
      <p>*) Isi pada salah satu kolom.</p>
      <ol>
        <li>Skor (0–100); Nilai Akhir = Bobot × Skor.</li>
        <li>
          Rekomendasi hasil seminar: “Tidak diterima” untuk nilai &lt;55,
          “Diterima” untuk nilai ≥55.
        </li>
        <li>
          Tuliskan catatan penilaian di belakang kertas ini jika catatan yang
          diberikan tidak mencukupi.
        </li>
      </ol>
    </div>
  );
}
export function AdvisorAssessment({
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
      <p>Bersama ini {PERSON_LABELS[recipient]} dari mahasiswa:</p>
      <Identity data={data} program />
      <StageChoices stage={stage} label="Tahapan Bimbingan" />
      <p>Dengan ini memberi nilai dengan rincian sebagai berikut:</p>
      <AssessmentTable sections={ADVISOR_RUBRIC} />
      <div className="form-notes">
        <p>Keterangan:</p>
        <p>* Lembar nilai ini diperbanyak sesuai jumlah pembimbing.</p>
        <p>
          ** Jika pembimbing lebih dari satu, nilai total akhir pelaksanaan
          bimbingan adalah rata-rata nilai total masing-masing pembimbing.
        </p>
      </div>
      <RightSignature data={data} person={recipient} dated />
    </>
  );
}
export function ExaminerAssessment({
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
      <div className="form-assessor-choices">
        <span>DOSEN PENILAI*:</span>
        <div>
          <Choice checked={recipient.startsWith("advisor")}>PEMBIMBING</Choice>
          <Choice checked={recipient.startsWith("examiner")}>PENGUJI</Choice>
        </div>
      </div>
      <StageChoices stage={stage} />
      <table className="form-grid form-assessment-identity">
        <tbody>
          <tr>
            <th>NAMA</th>
            <td>{data.name}</td>
          </tr>
          <tr>
            <th>NIM</th>
            <td>{data.nim}</td>
          </tr>
          <tr>
            <th>PRODI</th>
            <td>{data.program}</td>
          </tr>
          <tr>
            <th>JUDUL TA</th>
            <td>
              <TitleValue text={data.title} />
            </td>
          </tr>
        </tbody>
      </table>
      <AssessmentTable sections={EXAM_RUBRIC} />
      <p>
        Nilai Akhir: <BlankLine width="40pt" /> (<BlankLine width="260pt" />)
      </p>
      <RightSignature data={data} person={recipient} dated />
      <AssessmentNotes />
    </>
  );
}
export function ChairAssessment({ data }: { data: FormData }) {
  return (
    <>
      <p>Bersama ini Ketua Sidang Tugas Akhir dari mahasiswa:</p>
      <Identity data={data} program uppercase titleLines />
      <p>Dengan rincian nilai sebagai berikut:</p>
      <AssessmentTable sections={CHAIR_RUBRIC} />
      <AssessmentNotes />
      <RightSignature data={data} person="chair" label="Ketua Sidang" dated />
    </>
  );
}
export function FinalGrade({
  data,
  stage,
}: {
  data: FormData;
  stage: FormStage;
}) {
  return (
    <>
      <p>Dewan Penguji Tugas Akhir dengan ini menyatakan bahwa,</p>
      <Identity data={data} program titleLines />
      <p>Dengan nilai,</p>
      <table className="form-grid form-final-grade">
        <colgroup>
          <col style={{ width: "58%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>TAHAPAN PENILAIAN</th>
            <th>SKOR</th>
            <th>NILAI BOBOT</th>
            <th>NILAI AKHIR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              1. {stage === "proposal" ? "Proposal" : "Sidang"} Tugas Akhir
            </td>
            <td data-faculty-blank="exam-score" />
            <td className="form-center">60%</td>
            <td data-faculty-blank="exam-weighted" />
          </tr>
          <tr>
            <td>2. Bimbingan Tugas Akhir</td>
            <td data-faculty-blank="guidance-score" />
            <td className="form-center">40%</td>
            <td data-faculty-blank="guidance-weighted" />
          </tr>
          <tr>
            <th>TOTAL NILAI</th>
            <td />
            <th>100%</th>
            <td data-faculty-blank="final-score" />
          </tr>
        </tbody>
      </table>
      <p>
        Nilai: <BlankLine width="40pt" /> (<BlankLine width="250pt" />)
      </p>
      <p className="form-grade-decision">
        Dinyatakan: LULUS / LULUS BERSYARAT / TIDAK LULUS* dengan nilai huruf:
        (A / A− / B+ / B / B− / C+ / C)*
      </p>
      <h3 className="form-committee-heading">DEWAN PENGUJI</h3>
      <div className="form-signatures form-final-signatures">
        <Signature data={data} person="examiner1" />
        <Signature data={data} person="examiner2" />
        <Signature data={data} person="advisor1" />
        {hasSecondAdvisor(data) ? (
          <Signature data={data} person="advisor2" />
        ) : (
          <div />
        )}
        <Signature
          data={data}
          person="head"
          label="Ketua Program Studi"
          knowing
        />
        <Signature data={data} person="chair" label="Ketua Sidang" dated />
      </div>
      <p className="form-notes">* Coret yang tidak perlu.</p>
    </>
  );
}
