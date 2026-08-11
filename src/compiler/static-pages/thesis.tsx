import { AbstractEnglish, AbstractIndonesian } from "@/compiler/sheets/abstracts";
import { Constent } from "@/compiler/sheets/consent";
import { Cover } from "@/compiler/sheets/cover";
import { Foreword } from "@/compiler/sheets/foreword";
import { IPR } from "@/compiler/sheets/ipr";
import { Presentation } from "@/compiler/sheets/presentation";
import { Statement } from "@/compiler/sheets/statement";
import { Validity } from "@/compiler/sheets/validity";

export const Thesis = () => {
    return (
        <>
            <Cover />
            <Constent />
            <Validity />
            <IPR />
            <Statement />
            <Presentation />
            <Foreword />
            <AbstractIndonesian />
            <AbstractEnglish />
        </>
    );
};
