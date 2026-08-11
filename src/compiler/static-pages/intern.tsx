import { Cover } from "../sheets/cover";
import { Foreword } from "../sheets/foreword";
import { CompanyConsent } from "../sheets/intern/company-validity";
import { UniversityConsent } from "../sheets/intern/university-validity";

export const Intern = () => {

    return (
        <>
            <Cover />
            <CompanyConsent />
            <UniversityConsent />
            <Foreword />

        </>
    );
};
