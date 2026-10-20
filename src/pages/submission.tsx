import { LoginGate } from "@/components/login-gate";
import { AdvisorSubmission } from "@/components/submission/advisor-submission";
import { StudentSubmission } from "@/components/submission/student-submission";
import { useUser } from "@/hooks/use-user"

export const Submission = () => {

    const { user } = useUser();

    if (!user) return <LoginGate />


    return user.role === "student" ? <StudentSubmission user={user} /> : <AdvisorSubmission user={user} />
}