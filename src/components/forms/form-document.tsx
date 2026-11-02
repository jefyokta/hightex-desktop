import { formTitle, type FormFile, type FormPrintInput } from "@/forms/model";
import { Letterhead } from "./form-elements";
import {
  GuidanceCard,
  InternshipCompletion,
  RevisionProof,
  SeminarAttendanceCard,
} from "./templates/administrative";
import {
  AdvisorAssessment,
  ChairAssessment,
  ExaminerAssessment,
  FinalGrade,
} from "./templates/assessment";
import {
  EventAttendance,
  EventMinutes,
  ScoreRecap,
} from "./templates/examination";

function FormContent({
  input,
  file,
}: {
  input: FormPrintInput;
  file: FormFile;
}) {
  const { data, stage } = input;
  switch (file.code) {
    case "B0":
      return <SeminarAttendanceCard data={data} />;
    case "B1":
      return <InternshipCompletion data={data} />;
    case "B2":
      return <GuidanceCard data={data} recipient={file.recipient!} />;
    case "B3":
      return (
        <RevisionProof data={data} stage={stage} recipient={file.recipient!} />
      );
    case "TA01":
      return <EventAttendance data={data} stage={stage} />;
    case "TA02":
      return (
        <AdvisorAssessment
          data={data}
          stage={stage}
          recipient={file.recipient!}
        />
      );
    case "TA03":
      return (
        <ExaminerAssessment
          data={data}
          stage={stage}
          recipient={file.recipient!}
        />
      );
    case "TA04":
      return <ChairAssessment data={data} />;
    case "TA07":
      return <EventMinutes data={data} stage={stage} />;
    case "TA08":
      return <ScoreRecap data={data} stage={stage} />;
    case "TA09":
    case "TA10":
      return <FinalGrade data={data} stage={stage} />;
  }
}
/** Authored HTML templates. PDF files are design references only. */
export function FormDocument({
  input,
  file,
}: {
  input: FormPrintInput;
  file: FormFile;
}) {
  const heading =
    file.code === "TA04"
      ? "PENILAIAN KETUA SIDANG TUGAS AKHIR"
      : file.code === "TA08"
        ? "REKAPITULASI NILAI PROPOSAL / SIDANG TUGAS AKHIR"
        : formTitle(file.code).toUpperCase();
  return (
    <div className="forms-pages">
      <article
        className={`forms-paper form-${file.code.toLowerCase()}`}
        data-form-code={file.code}
        style={{
          width: file.code === "B1" ? "596.52pt" : "596.04pt",
          height: "936pt",
        }}
      >
        <Letterhead />
        <div className="form-code">
          <span>
            Form{" "}
            {file.code.startsWith("TA")
              ? `TA ${file.code.slice(2)}`
              : file.code}
          </span>
        </div>
        <h1 className="form-heading">{heading}</h1>
        <div className="form-body">
          <FormContent input={input} file={file} />
        </div>
      </article>
    </div>
  );
}
